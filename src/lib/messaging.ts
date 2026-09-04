/**
 * Arquitetura de mensageria (confirmação automática de agendamentos).
 *
 * Hoje o envio efetivo é feito por link do WhatsApp (clique-para-enviar) e por
 * notificação interna. A estrutura abaixo já está preparada para provedores
 * externos (WhatsApp Cloud API, Evolution API, Z-API, Twilio, SMTP/Resend):
 * basta preencher as credenciais em Confirmações → Integrações e implementar
 * o `dispatch` do canal correspondente em `src/lib/messaging.server.ts`.
 */

export type MessageChannel = "whatsapp" | "sms" | "email";

export const CHANNELS: { id: MessageChannel; label: string; icon: string }[] = [
  { id: "whatsapp", label: "WhatsApp", icon: "💬" },
  { id: "sms", label: "SMS", icon: "📱" },
  { id: "email", label: "E-mail", icon: "✉️" },
];

export const WHATSAPP_PROVIDERS = [
  "manual",
  "whatsapp_cloud_api",
  "evolution_api",
  "z_api",
  "twilio",
];
export const SMS_PROVIDERS = ["manual", "twilio", "zenvia", "gatewayapi"];
export const EMAIL_PROVIDERS = ["manual", "resend", "sendgrid", "smtp"];

export const DEFAULT_CONFIRMATION_TEMPLATE =
  `Olá {{NomeCliente}} 👋\n\n` +
  `Este é um lembrete do seu agendamento.\n\n` +
  `📅 Data:\n{{Data}}\n\n` +
  `🕒 Horário:\n{{Hora}}\n\n` +
  `💈 Serviço:\n{{Servico}}\n\n` +
  `👨‍🔧 Profissional:\n{{Funcionario}}\n\n` +
  `Para confirmar seu horário clique abaixo:\n\n` +
  `{{LinkConfirmacao}}\n\n` +
  `Esperamos você!`;

export type TemplateVars = {
  NomeCliente: string;
  Data: string;
  Hora: string;
  Servico: string;
  Funcionario: string;
  LinkConfirmacao: string;
  Empresa: string;
};

export function renderTemplate(template: string, vars: Partial<TemplateVars>) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`{{\\s*${k}\\s*}}`, "gi"), v ?? ""),
    template,
  );
}

export const CONFIRMATION_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pronto para enviar", color: "bg-muted text-muted-foreground border-border" },
  sent: {
    label: "Enviado",
    color: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
  confirmed: {
    label: "Confirmado",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  cancelled: {
    label: "Cancelado",
    color: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  },
  failed: {
    label: "Falha no envio",
    color: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  },
  expired: {
    label: "Expirado",
    color: "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300 border-neutral-500/30",
  },
};

/** Intervalo mínimo entre reenvios manuais (minutos). */
export const RESEND_COOLDOWN_MIN = 30;

export function randomToken(len = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
