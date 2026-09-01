import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { waLink, waNumber } from "@/lib/format";
import { bearerToken } from "@/lib/public-security";

const requestSchema = z.object({ company_id: z.string().uuid() });

/**
 * Processes appointment reminders (24h, 1h, review) due for delivery.
 * Acionado manualmente por um membro autenticado da empresa. Converte apenas
 * os lembretes do tenant solicitado em notificações com link wa.me.
 */
export const Route = createFileRoute("/api/public/hooks/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = requestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Empresa inválida" }, { status: 400 });
        const companyId = parsed.data.company_id;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const accessToken = bearerToken(request.headers.get("authorization"));
        if (!accessToken) return Response.json({ error: "Não autenticado" }, { status: 401 });

        const { data: authData } = await supabaseAdmin.auth.getUser(accessToken);
        const userId = authData.user?.id;
        if (!userId) return Response.json({ error: "Sessão inválida" }, { status: 401 });

        const [{ data: membership }, { data: superRole }] = await Promise.all([
          supabaseAdmin
            .from("company_users")
            .select("company_id")
            .eq("company_id", companyId)
            .eq("user_id", userId)
            .eq("active", true)
            .maybeSingle(),
          supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "super_admin")
            .maybeSingle(),
        ]);
        if (!membership && !superRole)
          return Response.json({ error: "Sem acesso à empresa" }, { status: 403 });

        const now = new Date().toISOString();

        const { data: due } = await supabaseAdmin
          .from("appointment_reminders")
          .select("id, appointment_id, company_id, kind, scheduled_for")
          .eq("company_id", companyId)
          .is("sent_at", null)
          .lte("scheduled_for", now)
          .limit(500);

        if (!due?.length) {
          return Response.json({ processed: 0 });
        }

        // Preload companies for name / slug / whatsapp signature
        const { data: companies } = await supabaseAdmin
          .from("companies")
          .select("id, name, slug")
          .eq("id", companyId);
        const cmap = new Map((companies ?? []).map((c: any) => [c.id, c]));

        let processed = 0;

        for (const r of due) {
          const { data: appt } = await supabaseAdmin
            .from("appointments")
            .select("id, starts_at, ends_at, status, customer_id, company_id, staff_id")
            .eq("id", r.appointment_id)
            .maybeSingle();

          if (!appt) {
            await supabaseAdmin
              .from("appointment_reminders")
              .update({ sent_at: now })
              .eq("id", r.id);
            continue;
          }

          const skipStatuses = ["cancelled", "no_show"];
          if (skipStatuses.includes(appt.status)) {
            await supabaseAdmin
              .from("appointment_reminders")
              .update({ sent_at: now })
              .eq("id", r.id);
            continue;
          }
          if (r.kind !== "review" && appt.status === "completed") {
            await supabaseAdmin
              .from("appointment_reminders")
              .update({ sent_at: now })
              .eq("id", r.id);
            continue;
          }
          if (r.kind === "review" && appt.status !== "completed") {
            await supabaseAdmin
              .from("appointment_reminders")
              .update({ sent_at: now })
              .eq("id", r.id);
            continue;
          }

          const { data: cust } = await supabaseAdmin
            .from("customers")
            .select("name, phone")
            .eq("id", appt.customer_id!)
            .maybeSingle();

          const company = cmap.get(appt.company_id) as any;
          const companyName = company?.name ?? "";
          const slug = company?.slug ?? "";
          const origin = process.env.PUBLIC_APP_URL ?? "";
          const portalUrl = slug ? `${origin}/b/${slug}` : "";

          const whenDate = new Date(appt.starts_at);
          const whenPretty = whenDate.toLocaleString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
          const shortWhen = whenDate.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });

          let title = "Lembrete";
          let message = "";
          if (r.kind === "24h") {
            title = "Lembrete 24h";
            message =
              `Olá ${cust?.name ?? ""}! 👋\n\nPassando para lembrar do seu agendamento em *${companyName}* amanhã, ${whenPretty}.\n\n` +
              `Se precisar remarcar ou cancelar, é só responder por aqui. Até breve! ✨`;
          } else if (r.kind === "1h") {
            title = "Lembrete 1h";
            message = `Oi ${cust?.name ?? ""}! Seu horário em *${companyName}* é daqui a pouco (${shortWhen}). Já estamos te esperando! 💇`;
          } else if (r.kind === "review") {
            title = "Pedir avaliação";
            message =
              `Oi ${cust?.name ?? ""}! 💛\n\nObrigado por escolher a *${companyName}*. Que tal deixar uma avaliação rápida do seu atendimento?` +
              (portalUrl ? `\n\n${portalUrl}` : "") +
              `\n\nSua opinião ajuda muito!`;
          }

          const phone = waNumber(cust?.phone);
          const waUrl = phone ? waLink(phone, message) : null;

          await supabaseAdmin.from("notifications").insert({
            company_id: r.company_id,
            kind: `reminder_${r.kind}`,
            title,
            body: `${cust?.name ?? "Cliente"}${cust?.phone ? ` · ${cust.phone}` : ""} · ${shortWhen}`,
            link: r.kind === "review" ? "/app/reviews" : "/app/agenda",
            metadata: {
              appointment_id: appt.id,
              customer_name: cust?.name,
              phone: cust?.phone,
              message,
              wa_url: waUrl,
              kind: r.kind,
            },
          } as any);

          await supabaseAdmin.from("appointment_reminders").update({ sent_at: now }).eq("id", r.id);
          processed++;
        }

        return Response.json({ processed });
      },
    },
  },
});
