import { createFileRoute } from "@tanstack/react-router";
import {
  DEFAULT_REVIEW_TEMPLATE,
  renderReviewTemplate,
} from "@/lib/reviews";
import { waLink } from "@/lib/format";

/**
 * Envio automático dos convites de avaliação.
 * Executado por pg_cron (a cada 15 minutos).
 *
 * Os convites são criados pelo trigger `trg_generate_review_invite` quando um
 * agendamento é concluído. Este hook renderiza a mensagem, monta o link do
 * WhatsApp e cria a notificação interna com o texto pronto para envio.
 */
export const Route = createFileRoute("/api/public/hooks/review-invites")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const origin = process.env.PUBLIC_APP_URL || new URL(request.url).origin;
        const nowIso = new Date().toISOString();

        // Expira convites vencidos sem resposta
        await supabaseAdmin
          .from("review_invites")
          .update({ status: "expired" })
          .in("status", ["pending", "sent", "failed"])
          .lt("expires_at", nowIso);

        const { data: invites } = await supabaseAdmin
          .from("review_invites")
          .select("*")
          .eq("status", "pending")
          .gt("expires_at", nowIso)
          .limit(200);

        if (!invites?.length) return Response.json({ processed: 0 });

        const companyIds = Array.from(new Set(invites.map((i) => i.company_id)));
        const [{ data: companies }, { data: settingsRows }] = await Promise.all([
          supabaseAdmin.from("companies").select("id, name").in("id", companyIds),
          supabaseAdmin.from("review_settings").select("*").in("company_id", companyIds),
        ]);
        const cmap = new Map((companies ?? []).map((c: any) => [c.id, c]));
        const smap = new Map((settingsRows ?? []).map((s: any) => [s.company_id, s]));

        let processed = 0;

        for (const invite of invites) {
          const cfg: any = smap.get(invite.company_id) ?? {};
          if (cfg.auto_send_enabled === false) continue;

          const channels: string[] =
            Array.isArray(cfg.active_channels) && cfg.active_channels.length ? cfg.active_channels : ["whatsapp"];

          const [{ data: cust }, { data: stf }, { data: svcs }, { data: appt }] = await Promise.all([
            invite.customer_id
              ? supabaseAdmin.from("customers").select("name, phone, email").eq("id", invite.customer_id).maybeSingle()
              : Promise.resolve({ data: null } as any),
            invite.staff_id
              ? supabaseAdmin.from("staff").select("name").eq("id", invite.staff_id).maybeSingle()
              : Promise.resolve({ data: null } as any),
            supabaseAdmin.from("appointment_services").select("services(name)").eq("appointment_id", invite.appointment_id),
            supabaseAdmin.from("appointments").select("starts_at").eq("id", invite.appointment_id).maybeSingle(),
          ]);

          const serviceNames = (svcs ?? []).map((r: any) => r.services?.name).filter(Boolean).join(", ");
          const startsAt = appt?.starts_at ? new Date(appt.starts_at) : null;
          const link = `${origin}/avaliacao/${invite.token}`;

          const message = renderReviewTemplate(cfg.message_template || DEFAULT_REVIEW_TEMPLATE, {
            NomeCliente: cust?.name ?? "cliente",
            Empresa: (cmap.get(invite.company_id) as any)?.name ?? "",
            Data: startsAt ? startsAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
            Servico: serviceNames || "Atendimento",
            Funcionario: stf?.name ?? "Equipe",
            LinkAvaliacao: link,
          });

          const sendUrl = cust?.phone ? waLink(cust.phone, message) : null;
          const deliverable = Boolean(sendUrl) || Boolean(cust?.email);

          await supabaseAdmin
            .from("review_invites")
            .update({
              status: deliverable ? "sent" : "failed",
              channel: channels[0],
              message,
              send_url: sendUrl,
              sent_at: deliverable ? new Date().toISOString() : null,
              last_sent_at: new Date().toISOString(),
              send_attempts: (invite.send_attempts ?? 0) + 1,
              error: deliverable ? null : "Cliente sem telefone ou e-mail cadastrado",
            })
            .eq("id", invite.id);

          await supabaseAdmin.from("review_logs").insert({
            company_id: invite.company_id,
            invite_id: invite.id,
            appointment_id: invite.appointment_id,
            customer_id: invite.customer_id,
            event: deliverable ? "sent" : "failed",
            channel: channels[0],
            detail: deliverable ? link : "Cliente sem telefone ou e-mail",
          } as any);

          if (deliverable) {
            await supabaseAdmin.from("notifications").insert({
              company_id: invite.company_id,
              kind: "review_invite",
              title: "Convite de avaliação pronto para envio",
              body: `${cust?.name ?? "Cliente"} · ${serviceNames || "Atendimento"}`,
              link: "/app/reviews",
              metadata: { invite_id: invite.id, send_url: sendUrl, message },
            } as any);
          }

          processed++;
        }

        return Response.json({ processed });
      },
    },
  },
});
