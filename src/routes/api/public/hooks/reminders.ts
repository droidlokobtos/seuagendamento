import { createFileRoute } from "@tanstack/react-router";

/**
 * Processes appointment reminders (24h, 1h, review) due for delivery.
 * Called by pg_cron every 15 min. Turns due reminders into in-app
 * notifications carrying a ready-to-send wa.me link, so staff can click
 * "Enviar no WhatsApp" and the message opens pre-filled.
 */
export const Route = createFileRoute("/api/public/hooks/reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();

        const { data: due } = await supabaseAdmin
          .from("appointment_reminders")
          .select("id, appointment_id, company_id, kind, scheduled_for")
          .is("sent_at", null)
          .lte("scheduled_for", now)
          .limit(500);

        if (!due?.length) {
          return Response.json({ processed: 0 });
        }

        // Preload companies for name / slug / whatsapp signature
        const companyIds = Array.from(new Set(due.map((r) => r.company_id)));
        const { data: companies } = await supabaseAdmin
          .from("companies")
          .select("id, name, slug")
          .in("id", companyIds);
        const cmap = new Map((companies ?? []).map((c: any) => [c.id, c]));

        let processed = 0;

        for (const r of due) {
          const { data: appt } = await supabaseAdmin
            .from("appointments")
            .select("id, starts_at, ends_at, status, customer_id, company_id, staff_id")
            .eq("id", r.appointment_id)
            .maybeSingle();

          if (!appt) {
            await supabaseAdmin.from("appointment_reminders").update({ sent_at: now }).eq("id", r.id);
            continue;
          }

          const skipStatuses = ["cancelled", "no_show"];
          if (skipStatuses.includes(appt.status)) {
            await supabaseAdmin.from("appointment_reminders").update({ sent_at: now }).eq("id", r.id);
            continue;
          }
          if (r.kind !== "review" && appt.status === "completed") {
            await supabaseAdmin.from("appointment_reminders").update({ sent_at: now }).eq("id", r.id);
            continue;
          }
          if (r.kind === "review" && appt.status !== "completed") {
            await supabaseAdmin.from("appointment_reminders").update({ sent_at: now }).eq("id", r.id);
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
            message =
              `Oi ${cust?.name ?? ""}! Seu horário em *${companyName}* é daqui a pouco (${shortWhen}). Já estamos te esperando! 💇`;
          } else if (r.kind === "review") {
            title = "Pedir avaliação";
            message =
              `Oi ${cust?.name ?? ""}! 💛\n\nObrigado por escolher a *${companyName}*. Que tal deixar uma avaliação rápida do seu atendimento?` +
              (portalUrl ? `\n\n${portalUrl}` : "") +
              `\n\nSua opinião ajuda muito!`;
          }

          const phoneDigits = (cust?.phone ?? "").replace(/\D/g, "");
          const waUrl = phoneDigits
            ? `https://wa.me/${phoneDigits.startsWith("55") ? phoneDigits : "55" + phoneDigits}?text=${encodeURIComponent(message)}`
            : null;

          // Fila oficial (link wa.me) usando o modelo da empresa
          const { queueWaEvent } = await import("@/lib/whatsapp.server");
          await queueWaEvent({
            companyId: r.company_id,
            event: r.kind === "review" ? "review_request" : "reminder",
            appointmentId: appt.id,
            customerId: appt.customer_id,
            phone: cust?.phone ?? null,
            vars: {
              nome_cliente: cust?.name ?? "cliente",
              nome_empresa: companyName,
              data: whenDate.toLocaleDateString("pt-BR"),
              horario: whenDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
              link_avaliacao: portalUrl,
            },
          });

          await supabaseAdmin.from("notifications").insert({
            company_id: r.company_id,
            kind: `reminder_${r.kind}`,
            title,
            body: `${cust?.name ?? "Cliente"}${cust?.phone ? ` · ${cust.phone}` : ""} · ${shortWhen}`,
            link: r.kind === "review" ? "/app/reviews" : "/app/whatsapp",
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
