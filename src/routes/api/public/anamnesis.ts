import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  BASE_SECTION, SECTIONS, buildQuestionnaire, extractAlerts, isExpired, sectionsForServices,
} from "@/lib/anamnesis-core";

const postSchema = z.object({
  slug: z.string().min(1),
  phone: z.string().trim().min(6).max(40),
  name: z.string().trim().min(2).max(120).optional(),
  service_ids: z.array(z.string().uuid()).max(10).default([]),
  answers: z.record(z.any()),
  consent_truth: z.boolean(),
  consent_procedure: z.boolean(),
  consent_lgpd: z.boolean(),
  signature_data: z.string().max(400_000).nullable().optional(),
});

async function loadCompany(admin: any, slug: string) {
  const { data } = await admin.from("companies").select("id,name,status").eq("slug", slug).maybeSingle();
  return data;
}

export const Route = createFileRoute("/api/public/anamnesis")({
  server: {
    handlers: {
      /** Verifica se o cliente precisa preencher a ficha para os serviços escolhidos. */
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const slug = url.searchParams.get("slug") ?? "";
        const phone = (url.searchParams.get("phone") ?? "").trim();
        const serviceIds = (url.searchParams.get("service_ids") ?? "").split(",").filter(Boolean);
        if (!slug) return Response.json({ error: "slug obrigatório" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const company = await loadCompany(supabaseAdmin, slug);
        if (!company) return Response.json({ error: "Empresa não encontrada" }, { status: 404 });

        let sections: string[] = [];
        if (serviceIds.length) {
          const { data: svcs } = await supabaseAdmin
            .from("services").select("id,name,category,anamnesis_section,company_id").in("id", serviceIds);
          sections = sectionsForServices((svcs ?? []).filter((s: any) => s.company_id === company.id));
        }

        let lastFilledAt: string | null = null;
        if (phone) {
          const { data: cust } = await supabaseAdmin
            .from("customers").select("id").eq("company_id", company.id).eq("phone", phone).maybeSingle();
          if (cust) {
            const { data: rec } = await supabaseAdmin
              .from("anamnesis_records").select("filled_at,sections")
              .eq("customer_id", cust.id).order("filled_at", { ascending: false }).limit(1).maybeSingle();
            if (rec) {
              lastFilledAt = rec.filled_at as string;
              // Se alguma seção nova (novo tipo de serviço) não estava na ficha anterior, exigir novamente.
              const prev: string[] = (rec.sections as string[]) ?? [];
              if (sections.some((s) => !prev.includes(s))) lastFilledAt = null;
            }
          }
        }

        const required = isExpired(lastFilledAt);
        return Response.json({
          required,
          reason: !lastFilledAt ? "never_or_new_service" : "expired",
          last_filled_at: lastFilledAt,
          sections,
          questionnaire: required ? buildQuestionnaire(sections) : [],
        });
      },

      /** Registra a ficha preenchida pelo cliente no portal público. */
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); }
        catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
        const parsed = postSchema.safeParse(body);
        if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
        const d = parsed.data;

        if (!d.consent_truth || !d.consent_procedure || !d.consent_lgpd)
          return Response.json({ error: "Consentimentos obrigatórios" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const company = await loadCompany(supabaseAdmin, d.slug);
        if (!company) return Response.json({ error: "Empresa não encontrada" }, { status: 404 });
        if (company.status === "suspended") return Response.json({ error: "Indisponível" }, { status: 403 });

        let sections: string[] = [];
        if (d.service_ids.length) {
          const { data: svcs } = await supabaseAdmin
            .from("services").select("id,name,category,anamnesis_section,company_id").in("id", d.service_ids);
          sections = sectionsForServices((svcs ?? []).filter((s: any) => s.company_id === company.id));
        }
        const questionnaire = [BASE_SECTION, ...sections.map((s) => SECTIONS[s]).filter(Boolean)];
        const alerts = extractAlerts(questionnaire, d.answers);

        // Cliente já existente por telefone, ou criado agora
        let customerId: string | null = null;
        const { data: cust } = await supabaseAdmin
          .from("customers").select("id").eq("company_id", company.id).eq("phone", d.phone).maybeSingle();
        customerId = cust?.id ?? null;
        if (!customerId) {
          const { data: created, error } = await supabaseAdmin
            .from("customers")
            .insert({ company_id: company.id, name: d.name || "Cliente", phone: d.phone, source: "portal_publico" } as any)
            .select("id").single();
          if (error) return Response.json({ error: error.message }, { status: 500 });
          customerId = created.id;
        }

        const { data: rec, error: rErr } = await supabaseAdmin
          .from("anamnesis_records")
          .insert({
            company_id: company.id,
            customer_id: customerId,
            sections,
            answers: d.answers,
            alerts,
            consent_truth: true,
            consent_procedure: true,
            consent_lgpd: true,
            signature_data: d.signature_data ?? null,
            filled_by: "customer",
          } as any)
          .select("id").single();
        if (rErr) return Response.json({ error: rErr.message }, { status: 500 });

        await supabaseAdmin.from("anamnesis_access_log").insert({
          company_id: company.id,
          customer_id: customerId,
          record_id: rec.id,
          action: "create",
          detail: "Preenchida pelo cliente no portal público",
        } as any);

        if (alerts.length) {
          await supabaseAdmin.from("notifications").insert({
            company_id: company.id,
            kind: "anamnesis_alert",
            title: "⚠️ Alerta de anamnese",
            body: alerts.slice(0, 3).join(" · "),
            link: "/app/customers",
            metadata: { customer_id: customerId, record_id: rec.id },
          } as any);
        }

        return Response.json({ ok: true, record_id: rec.id, alerts });
      },
    },
  },
});
