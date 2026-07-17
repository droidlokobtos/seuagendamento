import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  slug: z.string().min(1),
  service_ids: z.array(z.string().uuid()).min(1).max(10),
  staff_id: z.string().uuid().nullable().optional(),
  starts_at: z.string().min(10),
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
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
        }
        const { slug, service_ids, staff_id, starts_at, customer } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: company, error: cErr } = await supabaseAdmin
          .from("companies")
          .select("id,status")
          .eq("slug", slug)
          .maybeSingle();
        if (cErr || !company) return Response.json({ error: "Empresa não encontrada" }, { status: 404 });
        if (company.status === "suspended") {
          return Response.json({ error: "Agendamentos indisponíveis no momento" }, { status: 403 });
        }

        const { data: services, error: sErr } = await supabaseAdmin
          .from("services")
          .select("id,duration_min,price_cents,active,company_id")
          .in("id", service_ids);
        if (sErr) return Response.json({ error: sErr.message }, { status: 500 });
        if (!services?.length || services.length !== service_ids.length) {
          return Response.json({ error: "Serviço inválido" }, { status: 400 });
        }
        if (services.some((s) => s.company_id !== company.id || !s.active)) {
          return Response.json({ error: "Serviço não disponível" }, { status: 400 });
        }

        const totalMin = services.reduce((s, x) => s + (x.duration_min ?? 0), 0);
        const totalCents = services.reduce((s, x) => s + (x.price_cents ?? 0), 0);

        const start = new Date(starts_at);
        if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 60_000) {
          return Response.json({ error: "Horário inválido" }, { status: 400 });
        }
        const end = new Date(start.getTime() + totalMin * 60_000);

        if (staff_id) {
          const { data: st, error: stErr } = await supabaseAdmin
            .from("staff").select("id,active,company_id").eq("id", staff_id).maybeSingle();
          if (stErr || !st || st.company_id !== company.id || !st.active) {
            return Response.json({ error: "Profissional indisponível" }, { status: 400 });
          }
          // Conflict check for this staff
          const { data: conflicts } = await supabaseAdmin
            .from("appointments")
            .select("id")
            .eq("staff_id", staff_id)
            .neq("status", "cancelled")
            .lt("starts_at", end.toISOString())
            .gt("ends_at", start.toISOString());
          if (conflicts && conflicts.length > 0) {
            return Response.json({ error: "Horário já ocupado" }, { status: 409 });
          }
        }

        // Upsert customer by phone within company
        const { data: existing } = await supabaseAdmin
          .from("customers")
          .select("id")
          .eq("company_id", company.id)
          .eq("phone", customer.phone)
          .maybeSingle();

        let customerId = existing?.id ?? null;
        if (!customerId) {
          const { data: created, error: cuErr } = await supabaseAdmin
            .from("customers")
            .insert({
              company_id: company.id,
              name: customer.name,
              phone: customer.phone,
              email: customer.email || null,
            } as any)
            .select("id")
            .single();
          if (cuErr) return Response.json({ error: cuErr.message }, { status: 500 });
          customerId = created.id;
        }

        const { data: appt, error: aErr } = await supabaseAdmin
          .from("appointments")
          .insert({
            company_id: company.id,
            customer_id: customerId,
            staff_id: staff_id ?? null,
            starts_at: start.toISOString(),
            ends_at: end.toISOString(),
            status: "scheduled",
            total_cents: totalCents,
            notes: customer.notes || null,
          } as any)
          .select("id")
          .single();
        if (aErr) return Response.json({ error: aErr.message }, { status: 500 });

        const rows = services.map((s) => ({
          appointment_id: appt.id,
          service_id: s.id,
          price_cents: s.price_cents,
          duration_min: s.duration_min,
        }));
        const { error: asErr } = await supabaseAdmin.from("appointment_services").insert(rows as any);
        if (asErr) return Response.json({ error: asErr.message }, { status: 500 });

        return Response.json({
          ok: true,
          appointment_id: appt.id,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          total_cents: totalCents,
        });
      },
    },
  },
});
