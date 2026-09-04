import { createFileRoute } from "@tanstack/react-router";
import {
  DEFAULT_CONFIRMATION_TEMPLATE,
  RESEND_COOLDOWN_MIN,
  randomToken,
  renderTemplate,
} from "@/lib/messaging";
import { waLink, waNumber } from "@/lib/format";
import { runAutomationJob } from "@/lib/automation.server";

/**
 * Confirmação automática de agendamentos.
 * Executado por pg_cron a cada 10 minutos.
 *
 * Regra: agendamentos com status "scheduled" que iniciam dentro da janela de
 * antecedência configurada (padrão 24h) e que ainda não possuem confirmação
 * recebem um token único, a mensagem renderizada e uma notificação interna com
 * o link pronto para envio (WhatsApp / SMS / e-mail conforme os canais ativos).
 */
export const Route = createFileRoute("/api/public/hooks/confirmations")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        runAutomationJob(
          request,
          "appointment-confirmations",
          async ({ admin: supabaseAdmin, origin }) => {
            const nowIso = new Date().toISOString();

            // Expira tokens de agendamentos já passados
            const { error: expirationError } = await supabaseAdmin
              .from("appointment_confirmations")
              .update({ status: "expired" })
              .in("status", ["pending", "sent"])
              .lt("expires_at", nowIso);
            if (expirationError)
              throw new Error(`Falha ao expirar confirmações: ${expirationError.message}`);

            const { data: settingsRows, error: settingsError } = await supabaseAdmin
              .from("messaging_settings")
              .select("*");
            if (settingsError)
              throw new Error(`Falha ao carregar configurações: ${settingsError.message}`);
            const settings = new Map((settingsRows ?? []).map((s: any) => [s.company_id, s]));

            const maxWindow = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
            const { data: appts, error: appointmentsError } = await supabaseAdmin
              .from("appointments")
              .select("id, company_id, customer_id, staff_id, starts_at, status")
              .eq("status", "scheduled")
              .gt("starts_at", nowIso)
              .lt("starts_at", maxWindow)
              .limit(300);
            if (appointmentsError)
              throw new Error(`Falha ao carregar agendamentos: ${appointmentsError.message}`);

            if (!appts?.length) return { processed: 0, skipped: 0, failed: 0 };

            const { data: existing, error: existingError } = await supabaseAdmin
              .from("appointment_confirmations")
              .select("appointment_id")
              .in(
                "appointment_id",
                appts.map((a) => a.id),
              );
            if (existingError)
              throw new Error(
                `Falha ao verificar confirmações existentes: ${existingError.message}`,
              );
            const already = new Set((existing ?? []).map((r: any) => r.appointment_id));

            const companyIds = Array.from(new Set(appts.map((a) => a.company_id)));
            const { data: companies, error: companiesError } = await supabaseAdmin
              .from("companies")
              .select("id, name")
              .in("id", companyIds);
            if (companiesError)
              throw new Error(`Falha ao carregar empresas: ${companiesError.message}`);
            const cmap = new Map((companies ?? []).map((c: any) => [c.id, c]));

            let processed = 0;
            let skipped = 0;
            let failed = 0;

            for (const appt of appts) {
              if (already.has(appt.id)) {
                skipped++;
                continue;
              }

              const cfg: any = settings.get(appt.company_id) ?? {};
              if (cfg.auto_confirmation_enabled === false) {
                skipped++;
                continue;
              }

              const hours = Number(cfg.reminder_hours ?? 24);
              const startsAt = new Date(appt.starts_at);
              const dueFrom = new Date(startsAt.getTime() - hours * 3600 * 1000);
              if (Date.now() < dueFrom.getTime()) {
                skipped++;
                continue;
              }

              const channels: string[] =
                Array.isArray(cfg.active_channels) && cfg.active_channels.length
                  ? cfg.active_channels
                  : ["whatsapp"];

              const [customerResult, staffResult, servicesResult] = await Promise.all([
                appt.customer_id
                  ? supabaseAdmin
                      .from("customers")
                      .select("name, phone, email")
                      .eq("id", appt.customer_id)
                      .maybeSingle()
                  : Promise.resolve({ data: null } as any),
                appt.staff_id
                  ? supabaseAdmin.from("staff").select("name").eq("id", appt.staff_id).maybeSingle()
                  : Promise.resolve({ data: null } as any),
                supabaseAdmin
                  .from("appointment_services")
                  .select("service_id, services(name)")
                  .eq("appointment_id", appt.id),
              ]);

              const detailError = customerResult.error ?? staffResult.error ?? servicesResult.error;
              if (detailError) {
                failed++;
                continue;
              }
              const cust = customerResult.data;
              const stf = staffResult.data;
              const svcs = servicesResult.data;

              const serviceNames = (svcs ?? [])
                .map((r: any) => r.services?.name)
                .filter(Boolean)
                .join(", ");

              const token = randomToken(12);
              const link = `${origin}/confirmar/${token}`;
              const template = cfg.message_template || DEFAULT_CONFIRMATION_TEMPLATE;
              const message = renderTemplate(template, {
                NomeCliente: cust?.name ?? "cliente",
                Data: startsAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
                Hora: startsAt.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Sao_Paulo",
                }),
                Servico: serviceNames || "Atendimento",
                Funcionario: stf?.name ?? "Equipe",
                LinkConfirmacao: link,
                Empresa: (cmap.get(appt.company_id) as any)?.name ?? "",
              });

              const phone = waNumber(cust?.phone);
              const sendUrl = phone ? waLink(phone, message) : null;

              const { data: conf, error } = await supabaseAdmin
                .from("appointment_confirmations")
                .insert({
                  company_id: appt.company_id,
                  appointment_id: appt.id,
                  token,
                  channel: channels[0],
                  status: sendUrl || cust?.email ? "pending" : "failed",
                  message,
                  send_url: sendUrl,
                  sent_at: null,
                  last_sent_at: null,
                  send_attempts: 0,
                  error: sendUrl || cust?.email ? null : "Cliente sem telefone/e-mail cadastrado",
                  expires_at: startsAt.toISOString(),
                } as any)
                .select("id, status")
                .maybeSingle();

              if (error) {
                // Uma disputa entre duas execuções é inofensiva graças à chave única.
                if (error.code === "23505") skipped++;
                else failed++;
                continue;
              }

              const { error: logError } = await supabaseAdmin.from("messaging_logs").insert({
                company_id: appt.company_id,
                appointment_id: appt.id,
                confirmation_id: conf?.id ?? null,
                channel: channels[0],
                event: conf?.status === "failed" ? "failed" : "prepared",
                status: conf?.status,
                detail:
                  conf?.status === "failed"
                    ? "Cliente sem contato válido"
                    : `Lembrete gerado (${hours}h antes)`,
              } as any);

              if (logError)
                throw new Error(`Falha ao registrar log da confirmação: ${logError.message}`);

              const { error: notificationError } = await supabaseAdmin
                .from("notifications")
                .insert({
                  company_id: appt.company_id,
                  kind: conf?.status === "failed" ? "confirmation_failed" : "confirmation_ready",
                  title:
                    conf?.status === "failed"
                      ? "Falha no lembrete de confirmação"
                      : "Confirmação para enviar",
                  body: `${cust?.name ?? "Cliente"} · ${startsAt.toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "America/Sao_Paulo",
                  })}`,
                  link: "/app/confirmations",
                  metadata: {
                    appointment_id: appt.id,
                    confirmation_id: conf?.id,
                    message,
                    wa_url: sendUrl,
                    confirm_link: link,
                    cooldown_min: RESEND_COOLDOWN_MIN,
                  },
                } as any);
              if (notificationError)
                throw new Error(
                  `Falha ao criar notificação da confirmação: ${notificationError.message}`,
                );

              processed++;
            }

            return { processed, skipped, failed };
          },
        ),
    },
  },
});
