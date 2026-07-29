import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { computeDepositCents, depositConfigFromCompany } from "@/lib/finance";
import { isExpired, sectionsForServices } from "@/lib/anamnesis";

const schema = z.object({
  slug: z.string().min(1),
  service_ids: z.array(z.string().uuid()).min(1).max(10),
  staff_id: z.string().uuid().nullable().optional(),
  starts_at: z.string().min(10),
  coupon_code: z.string().trim().max(40).optional().or(z.literal("")),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(6).max(40),
    email: z.string().trim().email().max(160).optional().or(z.literal("")),
    notes: z.string().trim().max(500).optional(),
  }),
});

export const Route = createFileRoute("/api/public/book")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); }
        catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
        }
        const { slug, service_ids, staff_id, starts_at, customer, coupon_code } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: company } = await supabaseAdmin
          .from("companies")
          .select("id,name,status,online_booking_enabled,min_advance_min,max_advance_days,deposit_enabled,deposit_type,deposit_value,pix_key,pix_holder,pix_bank,pix_qr_url")
          .eq("slug", slug).maybeSingle();
        if (!company) return Response.json({ error: "Empresa não encontrada" }, { status: 404 });
        if (company.status === "suspended")
          return Response.json({ error: "Agendamentos indisponíveis no momento" }, { status: 403 });
        if ((company as any).online_booking_enabled === false)
          return Response.json({ error: "Agendamento online desativado" }, { status: 403 });

        const { data: services } = await supabaseAdmin
          .from("services").select("id,name,category,anamnesis_section,duration_min,price_cents,active,company_id")
          .in("id", service_ids);
        if (!services?.length || services.length !== service_ids.length)
          return Response.json({ error: "Serviço inválido" }, { status: 400 });
        if (services.some((s) => s.company_id !== company.id || !s.active))
          return Response.json({ error: "Serviço não disponível" }, { status: 400 });

        const totalMin = services.reduce((s, x) => s + (x.duration_min ?? 0), 0);
        const totalCents = services.reduce((s, x) => s + (x.price_cents ?? 0), 0);

        // Validate coupon (server-side, authoritative)
        let couponId: string | null = null;
        let couponCode: string | null = null;
        let discountCents = 0;
        if (coupon_code && coupon_code.trim()) {
          const { data: v } = await supabaseAdmin.rpc("validate_coupon", {
            _company: company.id, _code: coupon_code.trim(), _subtotal_cents: totalCents,
          });
          const row = Array.isArray(v) ? v[0] : v;
          if (!row || row.message !== "ok") {
            return Response.json({ error: row?.message || "Cupom inválido" }, { status: 400 });
          }
          couponId = row.id;
          couponCode = row.code;
          discountCents = row.discount_cents ?? 0;
        }

        const start = new Date(starts_at);
        if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 60_000)
          return Response.json({ error: "Horário inválido" }, { status: 400 });
        const minAdv = (company as any).min_advance_min ?? 0;
        const maxAdv = (company as any).max_advance_days ?? 60;
        if (start.getTime() < Date.now() + minAdv * 60_000)
          return Response.json({ error: `Agende com ao menos ${minAdv} min de antecedência` }, { status: 400 });
        if (start.getTime() > Date.now() + maxAdv * 86_400_000)
          return Response.json({ error: `Agende com no máximo ${maxAdv} dias de antecedência` }, { status: 400 });
        const end = new Date(start.getTime() + totalMin * 60_000);

        if (staff_id) {
          const { data: st } = await supabaseAdmin
            .from("staff").select("id,active,company_id").eq("id", staff_id).maybeSingle();
          if (!st || st.company_id !== company.id || !st.active)
            return Response.json({ error: "Profissional indisponível" }, { status: 400 });
          const { data: conflicts } = await supabaseAdmin
            .from("appointments").select("id")
            .eq("company_id", company.id)
            .eq("staff_id", staff_id)
            .neq("status", "cancelled")
            .lt("starts_at", end.toISOString()).gt("ends_at", start.toISOString());
          if (conflicts && conflicts.length > 0)
            return Response.json({ error: "Horário já ocupado" }, { status: 409 });
        } else {
          // Sem profissional escolhido: impede sobreposição com outros
          // agendamentos "sem profissional" da mesma empresa.
          const { data: conflicts } = await supabaseAdmin
            .from("appointments").select("id")
            .eq("company_id", company.id)
            .is("staff_id", null)
            .neq("status", "cancelled")
            .lt("starts_at", end.toISOString()).gt("ends_at", start.toISOString());
          if (conflicts && conflicts.length > 0)
            return Response.json({ error: "Horário já ocupado" }, { status: 409 });
        }

        // Bloqueios de agenda (feriados, folgas, etc.)
        const { data: blocks } = await supabaseAdmin
          .from("time_blocks").select("id,staff_id")
          .eq("company_id", company.id)
          .lt("starts_at", end.toISOString()).gt("ends_at", start.toISOString());
        if ((blocks ?? []).some((b) => !b.staff_id || b.staff_id === staff_id))
          return Response.json({ error: "Horário indisponível" }, { status: 409 });


        // Optional: identify signed-in customer via bearer token
        let authUserId: string | null = null;
        const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
        if (authHeader?.startsWith("Bearer ")) {
          const token = authHeader.slice(7);
          const { data: u } = await supabaseAdmin.auth.getUser(token);
          authUserId = u?.user?.id ?? null;
        }

        let customerId: string | null = null;
        if (authUserId) {
          const { data: byUser } = await supabaseAdmin
            .from("customers").select("id")
            .eq("company_id", company.id).eq("user_id", authUserId).maybeSingle();
          customerId = byUser?.id ?? null;
        }
        if (!customerId) {
          const { data: byPhone } = await supabaseAdmin
            .from("customers").select("id,user_id")
            .eq("company_id", company.id).eq("phone", customer.phone).maybeSingle();
          if (byPhone) {
            customerId = byPhone.id;
            if (authUserId && !byPhone.user_id) {
              await supabaseAdmin.from("customers").update({ user_id: authUserId } as any).eq("id", byPhone.id);
            }
          }
        }
        if (!customerId) {
          const { data: created, error: cuErr } = await supabaseAdmin
            .from("customers")
            .insert({
              company_id: company.id,
              name: customer.name, phone: customer.phone,
              email: customer.email || null,
              user_id: authUserId,
              source: "portal_publico",
              notes: customer.notes ? `[Portal público] ${customer.notes}` : null,
            } as any)
            .select("id").single();
          if (cuErr) return Response.json({ error: cuErr.message }, { status: 500 });
          customerId = created.id;
        }

        // Segurança do fluxo público: não permite criar a reserva quando a
        // anamnese obrigatória ainda não foi preenchida ou está vencida.
        const requiredSections = sectionsForServices(services ?? []);
        const { data: lastAnamnesis } = await supabaseAdmin
          .from("anamnesis_records")
          .select("id,filled_at,sections")
          .eq("company_id", company.id)
          .eq("customer_id", customerId)
          .order("filled_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const previousSections = ((lastAnamnesis?.sections as string[] | null) ?? []);
        const hasNewSection = requiredSections.some((section) => !previousSections.includes(section));
        if (!lastAnamnesis || isExpired(lastAnamnesis.filled_at as string | null) || hasNewSection) {
          return Response.json(
            { error: "Preencha a ficha de anamnese antes de confirmar o agendamento.", anamnesis_required: true },
            { status: 409 },
          );
        }

        // Controle de comparecimento: bloqueio ou sinal obrigatório por histórico de faltas
        const { data: ruleRows } = await supabaseAdmin.rpc("customer_booking_rule", {
          _company: company.id,
          _customer: customerId,
        });
        const rule = (ruleRows as any[] | null)?.[0] ?? { action: "none" };
        if (rule.action === "block") {
          return Response.json(
            {
              error:
                "Não é possível concluir o agendamento online devido a faltas anteriores. Entre em contato com o estabelecimento.",
            },
            { status: 403 },
          );
        }

        // Regra financeira central: total devido e sinal exigido
        const dueCents = Math.max(0, totalCents - discountCents);
        let depositCents = computeDepositCents(dueCents, depositConfigFromCompany(company));
        if (rule.action === "require_deposit" && depositCents === 0 && dueCents > 0) {
          depositCents = Math.round(dueCents * 0.5);
        }


        const { data: appt, error: aErr } = await supabaseAdmin
          .from("appointments")
          .insert({
            company_id: company.id, customer_id: customerId,
            staff_id: staff_id ?? null,
            starts_at: start.toISOString(), ends_at: end.toISOString(),
            status: "scheduled",
            total_cents: totalCents,
            coupon_id: couponId,
            coupon_code: couponCode,
            discount_cents: discountCents,
            deposit_required_cents: depositCents,
            notes: customer.notes || null,
          } as any).select("id").single();
        if (aErr) return Response.json({ error: aErr.message }, { status: 500 });

        const rows = services.map((s) => ({
          appointment_id: appt.id, service_id: s.id,
          price_cents: s.price_cents, duration_min: s.duration_min,
        }));
        const { error: asErr } = await supabaseAdmin.from("appointment_services").insert(rows as any);
        if (asErr) return Response.json({ error: asErr.message }, { status: 500 });

        let pixQr: string | null = null;
        if (depositCents > 0 && (company as any).pix_qr_url) {
          const raw = String((company as any).pix_qr_url);
          if (/^https?:\/\//.test(raw)) pixQr = raw;
          else {
            const { data: signed } = await supabaseAdmin.storage
              .from("company-assets").createSignedUrl(raw, 60 * 60);
            pixQr = signed?.signedUrl ?? null;
          }
        }

        return Response.json({
          ok: true,
          appointment_id: appt.id,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          subtotal_cents: totalCents,
          discount_cents: discountCents,
          total_cents: dueCents,
          deposit_required_cents: depositCents,
          balance_cents: Math.max(0, dueCents - depositCents),
          pix: depositCents > 0
            ? {
                key: (company as any).pix_key ?? null,
                holder: (company as any).pix_holder ?? null,
                bank: (company as any).pix_bank ?? null,
                qr_url: pixQr,
              }
            : null,
        });
      },
    },
  },
});
