import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_REVIEW_TEMPLATE, renderReviewTemplate } from "@/lib/reviews";
import { waLink } from "@/lib/format";
import { runAutomationJob } from "@/lib/automation.server";

/**
 * Preparação automática dos convites de avaliação.
 * Executado por pg_cron (a cada 15 minutos).
 *
 * Os convites são criados pelo trigger `trg_generate_review_invite` quando um
 * agendamento é concluído. Este hook renderiza a mensagem, monta o link do
 * WhatsApp e cria a notificação interna. Ele não declara a mensagem como
 * enviada; a confirmação do envio continua manual.
 */
export const Route = createFileRoute("/api/public/hooks/review-invites")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        runAutomationJob(request, "review-invites", async ({ admin: supabaseAdmin, origin }) => {
          const nowIso = new Date().toISOString();

          // Expira convites vencidos sem resposta
          const { error: expirationError } = await supabaseAdmin
            .from("review_invites")
            .update({ status: "expired" })
            .in("status", ["pending", "ready", "sent", "failed"])
            .lt("expires_at", nowIso);
          if (expirationError)
            throw new Error(`Falha ao expirar convites: ${expirationError.message}`);

          const { data: invites, error: invitesError } = await supabaseAdmin
            .from("review_invites")
            .select("*")
            .eq("status", "pending")
            .gt("expires_at", nowIso)
            .limit(200);
          if (invitesError) throw new Error(`Falha ao carregar convites: ${invitesError.message}`);

          if (!invites?.length) return { processed: 0, skipped: 0, failed: 0 };

          const companyIds = Array.from(new Set(invites.map((i) => i.company_id)));
          const [companiesResult, settingsResult] = await Promise.all([
            supabaseAdmin.from("companies").select("id, name").in("id", companyIds),
            supabaseAdmin.from("review_settings").select("*").in("company_id", companyIds),
          ]);
          const baseError = companiesResult.error ?? settingsResult.error;
          if (baseError)
            throw new Error(`Falha ao carregar dados dos convites: ${baseError.message}`);
          const companies = companiesResult.data;
          const settingsRows = settingsResult.data;
          const cmap = new Map((companies ?? []).map((c: any) => [c.id, c]));
          const smap = new Map((settingsRows ?? []).map((s: any) => [s.company_id, s]));

          let processed = 0;
          let skipped = 0;
          let failed = 0;

          for (const invite of invites) {
            const cfg: any = smap.get(invite.company_id) ?? {};
            if (cfg.auto_send_enabled === false) {
              skipped++;
              continue;
            }

            const channels: string[] =
              Array.isArray(cfg.active_channels) && cfg.active_channels.length
                ? cfg.active_channels
                : ["whatsapp"];

            const [customerResult, staffResult, servicesResult, appointmentResult] =
              await Promise.all([
                invite.customer_id
                  ? supabaseAdmin
                      .from("customers")
                      .select("name, phone, email")
                      .eq("id", invite.customer_id)
                      .maybeSingle()
                  : Promise.resolve({ data: null } as any),
                invite.staff_id
                  ? supabaseAdmin
                      .from("staff")
                      .select("name")
                      .eq("id", invite.staff_id)
                      .maybeSingle()
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
            const detailError =
              customerResult.error ??
              staffResult.error ??
              servicesResult.error ??
              appointmentResult.error;
            if (detailError) {
              failed++;
              continue;
            }
            const cust = customerResult.data;
            const stf = staffResult.data;
            const svcs = servicesResult.data;
            const appt = appointmentResult.data;

            const serviceNames = (svcs ?? [])
              .map((r: any) => r.services?.name)
              .filter(Boolean)
              .join(", ");
            const startsAt = appt?.starts_at ? new Date(appt.starts_at) : null;
            const link = `${origin}/avaliacao/${invite.token}`;

            const message = renderReviewTemplate(cfg.message_template || DEFAULT_REVIEW_TEMPLATE, {
              NomeCliente: cust?.name ?? "cliente",
              Empresa: (cmap.get(invite.company_id) as any)?.name ?? "",
              Data: startsAt
                ? startsAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
                : "",
              Servico: serviceNames || "Atendimento",
              Funcionario: stf?.name ?? "Equipe",
              LinkAvaliacao: link,
            });

            const sendUrl = cust?.phone ? waLink(cust.phone, message) : null;
            const deliverable = Boolean(sendUrl) || Boolean(cust?.email);

            const { error: updateError } = await supabaseAdmin
              .from("review_invites")
              .update({
                status: deliverable ? "ready" : "failed",
                channel: channels[0],
                message,
                send_url: sendUrl,
                sent_at: null,
                last_sent_at: null,
                error: deliverable ? null : "Cliente sem telefone ou e-mail cadastrado",
              })
              .eq("id", invite.id)
              .eq("status", "pending");
            if (updateError) {
              failed++;
              continue;
            }

            const { error: logError } = await supabaseAdmin.from("review_logs").insert({
              company_id: invite.company_id,
              invite_id: invite.id,
              appointment_id: invite.appointment_id,
              customer_id: invite.customer_id,
              event: deliverable ? "prepared" : "failed",
              channel: channels[0],
              detail: deliverable ? link : "Cliente sem telefone ou e-mail",
            } as any);
            if (logError)
              throw new Error(`Falha ao registrar log da avaliação: ${logError.message}`);

            if (deliverable) {
              const { error: notificationError } = await supabaseAdmin
                .from("notifications")
                .insert({
                  company_id: invite.company_id,
                  kind: "review_invite",
                  title: "Convite de avaliação pronto para envio",
                  body: `${cust?.name ?? "Cliente"} · ${serviceNames || "Atendimento"}`,
                  link: "/app/reviews",
                  metadata: { invite_id: invite.id, send_url: sendUrl, message },
                } as any);
              if (notificationError)
                throw new Error(
                  `Falha ao criar notificação da avaliação: ${notificationError.message}`,
                );
            }

            processed++;
          }

          return { processed, skipped, failed };
        }),
    },
  },
});
