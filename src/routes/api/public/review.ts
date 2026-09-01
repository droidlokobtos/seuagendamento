import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { GOOGLE_REDIRECT_MIN_RATING, NEGATIVE_ALERT_MAX_RATING } from "@/lib/reviews";
import { guardPublicRequest, rateLimitResponse } from "@/lib/public-api-protection.server";

/**
 * Endpoint público do módulo de avaliação.
 *  GET  /api/public/review?token=XYZ  → dados do convite
 *  POST /api/public/review            → registra a avaliação (token de uso único)
 */

const bodySchema = z.object({
  token: z.string().trim().min(6).max(64),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
  staffRating: z.number().int().min(1).max(5).optional(),
  wouldReturn: z.boolean().optional(),
  wouldRecommend: z.boolean().optional(),
});

export const Route = createFileRoute("/api/public/review")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token")?.trim();
        if (!token) return Response.json({ error: "Token ausente" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const guard = await guardPublicRequest(supabaseAdmin, request, {
          scope: "review:get",
          limit: 40,
          windowSeconds: 300,
        });
        if (!guard.allowed) return rateLimitResponse(guard.retryAfter);
        const { data: invite } = await supabaseAdmin
          .from("review_invites")
          .select("*")
          .eq("token", token)
          .maybeSingle();

        if (!invite) return Response.json({ error: "Link de avaliação inválido" }, { status: 404 });

        const expired = new Date(invite.expires_at).getTime() < Date.now();
        if (expired && !["answered"].includes(invite.status)) {
          await supabaseAdmin
            .from("review_invites")
            .update({ status: "expired" })
            .eq("id", invite.id);
        }

        const [
          { data: company },
          { data: settings },
          { data: cust },
          { data: stf },
          { data: svcs },
          { data: appt },
        ] = await Promise.all([
          supabaseAdmin
            .from("companies")
            .select("name, logo_url, slug, primary_color")
            .eq("id", invite.company_id)
            .maybeSingle(),
          supabaseAdmin
            .from("review_settings")
            .select("google_review_url")
            .eq("company_id", invite.company_id)
            .maybeSingle(),
          invite.customer_id
            ? supabaseAdmin
                .from("customers")
                .select("name")
                .eq("id", invite.customer_id)
                .maybeSingle()
            : Promise.resolve({ data: null } as any),
          invite.staff_id
            ? supabaseAdmin.from("staff").select("name").eq("id", invite.staff_id).maybeSingle()
            : Promise.resolve({ data: null } as any),
          supabaseAdmin
            .from("appointment_services")
            .select("services(name)")
            .eq("appointment_id", invite.appointment_id),
          supabaseAdmin
            .from("appointments")
            .select("starts_at")
            .eq("id", invite.appointment_id)
            .maybeSingle(),
        ]);

        return Response.json({
          status: expired && invite.status !== "answered" ? "expired" : invite.status,
          expired: expired && invite.status !== "answered",
          rating: invite.rating,
          respondedAt: invite.responded_at,
          googleReviewUrl: settings?.google_review_url ?? null,
          company: {
            name: company?.name ?? "Estabelecimento",
            logo_url: company?.logo_url ?? null,
            slug: company?.slug ?? null,
          },
          appointment: {
            startsAt: appt?.starts_at ?? null,
            customerName: cust?.name ?? "Cliente",
            staffName: stf?.name ?? "Equipe",
            services: (svcs ?? []).map((r: any) => r.services?.name).filter(Boolean),
          },
        });
      },

      POST: async ({ request }) => {
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
        const { token, rating, comment, staffRating, wouldReturn, wouldRecommend } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const guard = await guardPublicRequest(supabaseAdmin, request, {
          scope: "review:submit",
          limit: 5,
          windowSeconds: 900,
        });
        if (!guard.allowed) return rateLimitResponse(guard.retryAfter);
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          null;
        const userAgent = request.headers.get("user-agent")?.slice(0, 400) ?? null;

        const { data: invite } = await supabaseAdmin
          .from("review_invites")
          .select("*")
          .eq("token", token)
          .maybeSingle();

        if (!invite) return Response.json({ error: "Link de avaliação inválido" }, { status: 404 });
        if (invite.status === "answered")
          return Response.json({ error: "Esta avaliação já foi enviada" }, { status: 409 });
        if (new Date(invite.expires_at).getTime() < Date.now()) {
          await supabaseAdmin
            .from("review_invites")
            .update({ status: "expired" })
            .eq("id", invite.id);
          return Response.json({ error: "Este link de avaliação expirou" }, { status: 410 });
        }

        const { data: svcs } = await supabaseAdmin
          .from("appointment_services")
          .select("services(name)")
          .eq("appointment_id", invite.appointment_id);
        const serviceNames = (svcs ?? [])
          .map((r: any) => r.services?.name)
          .filter(Boolean)
          .join(", ");

        const { data: review, error: reviewError } = await supabaseAdmin
          .from("reviews")
          .insert({
            company_id: invite.company_id,
            appointment_id: invite.appointment_id,
            customer_id: invite.customer_id,
            staff_id: invite.staff_id,
            invite_id: invite.id,
            rating,
            comment: comment || null,
            staff_rating: staffRating ?? null,
            would_return: wouldReturn ?? null,
            would_recommend: wouldRecommend ?? null,
            service_names: serviceNames || null,
            source: "link",
            ip,
            user_agent: userAgent,
            published: rating >= GOOGLE_REDIRECT_MIN_RATING,
          } as any)
          .select("id")
          .maybeSingle();

        if (reviewError) return Response.json({ error: reviewError.message }, { status: 400 });

        await supabaseAdmin
          .from("review_invites")
          .update({
            status: "answered",
            rating,
            review_id: review?.id ?? null,
            responded_at: new Date().toISOString(),
            response_ip: ip,
            response_user_agent: userAgent,
          })
          .eq("id", invite.id);

        await supabaseAdmin.from("review_logs").insert({
          company_id: invite.company_id,
          invite_id: invite.id,
          review_id: review?.id ?? null,
          appointment_id: invite.appointment_id,
          customer_id: invite.customer_id,
          event: "answered",
          rating,
          comment: comment || null,
          ip,
          user_agent: userAgent,
        } as any);

        const { data: cust } = invite.customer_id
          ? await supabaseAdmin
              .from("customers")
              .select("name")
              .eq("id", invite.customer_id)
              .maybeSingle()
          : { data: null as any };

        const negative = rating <= NEGATIVE_ALERT_MAX_RATING;
        await supabaseAdmin.from("notifications").insert({
          company_id: invite.company_id,
          kind: negative ? "review_negative" : "review_received",
          title: negative ? "⚠️ Avaliação negativa recebida" : "Nova avaliação recebida",
          body: `${cust?.name ?? "Cliente"} · ${rating}★${comment ? ` · "${comment.slice(0, 80)}"` : ""}`,
          link: "/app/reviews",
          metadata: { review_id: review?.id, invite_id: invite.id, rating },
        } as any);

        const { data: settings } = await supabaseAdmin
          .from("review_settings")
          .select("google_review_url")
          .eq("company_id", invite.company_id)
          .maybeSingle();

        return Response.json({
          ok: true,
          rating,
          googleReviewUrl:
            rating >= GOOGLE_REDIRECT_MIN_RATING ? (settings?.google_review_url ?? null) : null,
        });
      },
    },
  },
});
