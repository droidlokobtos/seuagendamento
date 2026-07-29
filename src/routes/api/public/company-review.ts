import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  GOOGLE_REDIRECT_MIN_RATING,
  NEGATIVE_ALERT_MAX_RATING,
} from "@/lib/reviews";

/**
 * Link público de avaliação por empresa (não depende de agendamento).
 *  GET  /api/public/company-review?token=XYZ  → dados da empresa + serviços + profissionais
 *  POST /api/public/company-review            → registra avaliação pública
 */

const bodySchema = z.object({
  token: z.string().trim().min(4).max(64),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
  customerName: z.string().trim().max(120).optional(),
  staffId: z.string().uuid().optional(),
  serviceName: z.string().trim().max(200).optional(),
});

export const Route = createFileRoute("/api/public/company-review")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token")?.trim();
        if (!token) return Response.json({ error: "Token ausente" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin
          .from("review_settings")
          .select("company_id, google_review_url, public_link_enabled")
          .eq("public_token", token)
          .maybeSingle();

        if (!settings) return Response.json({ error: "Link de avaliação inválido" }, { status: 404 });
        if (settings.public_link_enabled === false)
          return Response.json({ error: "Este link de avaliação está desativado" }, { status: 410 });

        const [{ data: company }, { data: services }, { data: staff }] = await Promise.all([
          supabaseAdmin
            .from("companies")
            .select("name, logo_url, banner_url, slug, primary_color")
            .eq("id", settings.company_id)
            .maybeSingle(),
          supabaseAdmin
            .from("services")
            .select("id, name")
            .eq("company_id", settings.company_id)
            .eq("active", true)
            .order("sort_order"),
          supabaseAdmin
            .from("staff")
            .select("id, name")
            .eq("company_id", settings.company_id)
            .eq("active", true)
            .order("name"),
        ]);

        if (!company) return Response.json({ error: "Link de avaliação inválido" }, { status: 404 });

        return Response.json({
          company: {
            name: company.name,
            logo_url: company.logo_url,
            banner_url: company.banner_url,
            slug: company.slug,
          },
          services: (services ?? []).map((s) => ({ id: s.id, name: s.name })),
          staff: (staff ?? []).map((s) => ({ id: s.id, name: s.name })),
          googleReviewUrl: settings.google_review_url ?? null,
        });
      },

      POST: async ({ request }) => {
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
        const { token, rating, comment, customerName, staffId, serviceName } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin
          .from("review_settings")
          .select("company_id, google_review_url, public_link_enabled")
          .eq("public_token", token)
          .maybeSingle();

        if (!settings) return Response.json({ error: "Link de avaliação inválido" }, { status: 404 });
        if (settings.public_link_enabled === false)
          return Response.json({ error: "Este link de avaliação está desativado" }, { status: 410 });

        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          null;
        const userAgent = request.headers.get("user-agent")?.slice(0, 400) ?? null;

        // Profissional precisa pertencer à empresa
        let validStaffId: string | null = null;
        if (staffId) {
          const { data: stf } = await supabaseAdmin
            .from("staff")
            .select("id")
            .eq("id", staffId)
            .eq("company_id", settings.company_id)
            .maybeSingle();
          validStaffId = stf?.id ?? null;
        }

        // Serviço precisa existir na empresa (evita texto arbitrário vindo do cliente)
        let validServiceName: string | null = null;
        if (serviceName) {
          const { data: svc } = await supabaseAdmin
            .from("services")
            .select("name")
            .eq("company_id", settings.company_id)
            .eq("name", serviceName)
            .maybeSingle();
          validServiceName = svc?.name ?? null;
        }


        const { data: review, error: reviewError } = await supabaseAdmin
          .from("reviews")
          .insert({
            company_id: settings.company_id,
            staff_id: validStaffId,
            rating,
            comment: comment || null,
            customer_name: customerName || null,
            service_names: serviceName || null,
            source: "public_link",
            ip,
            user_agent: userAgent,
            published: rating >= GOOGLE_REDIRECT_MIN_RATING,
          } as any)
          .select("id")
          .maybeSingle();

        if (reviewError) return Response.json({ error: reviewError.message }, { status: 400 });

        await supabaseAdmin.from("review_logs").insert({
          company_id: settings.company_id,
          review_id: review?.id ?? null,
          event: "public_link_answered",
          channel: "link",
          rating,
          comment: comment || null,
          ip,
          user_agent: userAgent,
        } as any);

        const negative = rating <= NEGATIVE_ALERT_MAX_RATING;
        await supabaseAdmin.from("notifications").insert({
          company_id: settings.company_id,
          kind: negative ? "review_negative" : "review_received",
          title: negative ? "⚠️ Avaliação negativa recebida" : "Nova avaliação recebida",
          body: `${customerName || "Cliente"} · ${rating}★${comment ? ` · "${comment.slice(0, 80)}"` : ""}`,
          link: "/app/reviews",
          metadata: { review_id: review?.id, rating, source: "public_link" },
        } as any);

        return Response.json({
          ok: true,
          rating,
          googleReviewUrl:
            rating >= GOOGLE_REDIRECT_MIN_RATING ? settings.google_review_url ?? null : null,
        });
      },
    },
  },
});
