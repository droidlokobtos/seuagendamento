/**
 * Módulo de avaliação com link próprio.
 * Centraliza template, validade, status e perguntas do formulário.
 */

export const DEFAULT_REVIEW_EXPIRATION_DAYS = 30;

export const DEFAULT_REVIEW_TEMPLATE =
  `Olá {{NomeCliente}} 👋\n\n` +
  `Obrigado por escolher a {{Empresa}}! 💛\n\n` +
  `Sua opinião é muito importante para nós.\n` +
  `Leva menos de 1 minuto para avaliar seu atendimento:\n\n` +
  `⭐ {{LinkAvaliacao}}\n\n` +
  `Até a próxima!`;

export type ReviewTemplateVars = {
  NomeCliente: string;
  Empresa: string;
  Data: string;
  Servico: string;
  Funcionario: string;
  LinkAvaliacao: string;
};

export function renderReviewTemplate(template: string, vars: Partial<ReviewTemplateVars>) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`{{\\s*${k}\\s*}}`, "gi"), v ?? ""),
    template,
  );
}

export const REVIEW_INVITE_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Preparando", color: "bg-muted text-muted-foreground border-border" },
  ready: {
    label: "Pronto para enviar",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  sent: {
    label: "Enviado",
    color: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
  answered: {
    label: "Respondido",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  expired: {
    label: "Expirado",
    color: "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300 border-neutral-500/30",
  },
  failed: {
    label: "Falha no envio",
    color: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  },
};

/** Notas a partir das quais o cliente é convidado a avaliar no Google. */
export const GOOGLE_REDIRECT_MIN_RATING = 4;

/** Notas que disparam alerta interno de atendimento negativo. */
export const NEGATIVE_ALERT_MAX_RATING = 3;

/** Intervalo mínimo entre reenvios manuais (minutos). */
export const REVIEW_RESEND_COOLDOWN_MIN = 30;

export const RATING_LABEL: Record<number, string> = {
  1: "Muito ruim",
  2: "Ruim",
  3: "Regular",
  4: "Bom",
  5: "Excelente",
};

export function reviewToken(len = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
