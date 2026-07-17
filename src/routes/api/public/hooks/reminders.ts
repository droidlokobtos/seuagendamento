import { createFileRoute } from "@tanstack/react-router";

/**
 * Processes appointment reminders due for delivery.
 * Cron via pg_cron (every 15 min): calls this endpoint to convert due reminders
 * into in-app notifications for the company. WhatsApp delivery is opened
 * manually from the notification (no external gateway required).
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
          .limit(200);

        if (!due?.length) {
          return Response.json({ processed: 0 });
        }

        for (const r of due) {
          const { data: appt } = await supabaseAdmin
            .from("appointments")
            .select("id, starts_at, status, customer_id, company_id")
            .eq("id", r.appointment_id)
            .maybeSingle();

          if (!appt || appt.status === "cancelled" || appt.status === "completed" || appt.status === "no_show") {
            await supabaseAdmin.from("appointment_reminders").update({ sent_at: now }).eq("id", r.id);
            continue;
          }

          const { data: cust } = await supabaseAdmin
            .from("customers").select("name, phone").eq("id", appt.customer_id!).maybeSingle();

          const when = new Date(appt.starts_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
          const title = r.kind === "24h" ? "Lembrete 24h" : "Lembrete 1h";
          const body = `${cust?.name ?? "Cliente"} · ${when}${cust?.phone ? ` · ${cust.phone}` : ""}`;

          await supabaseAdmin.from("notifications").insert({
            company_id: r.company_id,
            kind: "appointment_reminder",
            title,
            body,
            link: "/app/agenda",
            metadata: { appointment_id: appt.id, phone: cust?.phone },
          } as any);

          await supabaseAdmin.from("appointment_reminders").update({ sent_at: now }).eq("id", r.id);
        }

        return Response.json({ processed: due.length });
      },
    },
  },
});
