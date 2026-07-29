/**
 * Mensageria WhatsApp por LINK OFICIAL (https://wa.me/).
 *
 * Não existe nenhuma API, token ou integração externa: o sistema monta a
 * mensagem a partir do modelo da empresa, codifica o texto e abre o link
 * oficial do WhatsApp — que usa o WhatsApp Desktop quando instalado e o
 * WhatsApp Web caso contrário.
 */

export type WaEvent =
  | "appointment_created"
  | "appointment_confirmed"
  | "reminder"
  | "appointment_rescheduled"
  | "appointment_cancelled"
  | "deposit_required"
  | "deposit_approved"
  | "deposit_rejected"
  | "review_request"
  | "custom";

export const WA_EVENTS: { id: WaEvent; label: string; description: string; emoji: string }[] = [
  { id: "appointment_created", label: "Novo agendamento", description: "Enviado assim que o horário é criado.", emoji: "🆕" },
  { id: "appointment_confirmed", label: "Confirmação de agendamento", description: "Pedido/aviso de confirmação do horário.", emoji: "✅" },
  { id: "reminder", label: "Lembrete", description: "Lembrete do horário próximo.", emoji: "⏰" },
  { id: "appointment_rescheduled", label: "Reagendamento", description: "Novos dados do agendamento.", emoji: "🔄" },
  { id: "appointment_cancelled", label: "Cancelamento", description: "Aviso de cancelamento.", emoji: "❌" },
  { id: "deposit_required", label: "Pagamento antecipado", description: "Cobrança do sinal via PIX.", emoji: "💳" },
  { id: "deposit_approved", label: "Pagamento aprovado", description: "Comprovante validado.", emoji: "🎉" },
  { id: "deposit_rejected", label: "Pagamento recusado", description: "Problema na validação do comprovante.", emoji: "⚠️" },
  { id: "review_request", label: "Solicitação de avaliação", description: "Link de avaliação do sistema.", emoji: "⭐" },
  { id: "custom", label: "Mensagem personalizada", description: "Modelo livre para uso rápido.", emoji: "✍️" },
];

export const WA_VARIABLES = [
  "nome_cliente",
  "nome_empresa",
  "servico",
  "profissional",
  "data",
  "horario",
  "valor",
  "valor_sinal",
  "saldo_restante",
  "chave_pix",
  "telefone_empresa",
  "endereco_empresa",
  "observacoes",
  "link_avaliacao",
  "link_confirmacao",
] as const;

export type WaVars = Partial<Record<(typeof WA_VARIABLES)[number], string>>;

export const DEFAULT_TEMPLATES: Record<WaEvent, string> = {
  appointment_created:
    "Olá {{nome_cliente}}! 👋\n\nSeu agendamento na *{{nome_empresa}}* foi realizado com sucesso.\n\n💈 Serviço: {{servico}}\n👨‍🔧 Profissional: {{profissional}}\n📅 Data: {{data}}\n🕒 Horário: {{horario}}\n💰 Valor: {{valor}}\n\nQualquer dúvida, é só responder por aqui. Até breve! ✨",
  appointment_confirmed:
    "Oi {{nome_cliente}}! ✅\n\nSeu horário na *{{nome_empresa}}* está *confirmado*.\n\n📅 {{data}} às {{horario}}\n💈 {{servico}} com {{profissional}}\n\nTe esperamos! 💛",
  reminder:
    "Oi {{nome_cliente}}! ⏰\n\nLembrando do seu horário na *{{nome_empresa}}*.\n\n📅 {{data}} às {{horario}}\n💈 {{servico}} com {{profissional}}\n\nSe precisar remarcar, é só avisar. Até já! 💇",
  appointment_rescheduled:
    "Oi {{nome_cliente}}! 🔄\n\nSeu agendamento na *{{nome_empresa}}* foi remarcado.\n\n📅 Nova data: {{data}}\n🕒 Novo horário: {{horario}}\n💈 {{servico}} com {{profissional}}\n\nAté breve! ✨",
  appointment_cancelled:
    "Olá {{nome_cliente}}. ❌\n\nSeu agendamento na *{{nome_empresa}}* do dia {{data}} às {{horario}} foi *cancelado*.\n\nQuer escolher um novo horário? Me avise por aqui. 🗓️",
  deposit_required:
    "Olá {{nome_cliente}}! 💳\n\nPara garantir sua vaga na *{{nome_empresa}}*, é necessário o pagamento antecipado do sinal.\n\n💰 Valor total: {{valor}}\n🔒 Sinal: {{valor_sinal}}\n💵 Restante no atendimento: {{saldo_restante}}\n\n🔑 Chave PIX: {{chave_pix}}\n\nApós o pagamento, envie o comprovante aqui mesmo. 📎",
  deposit_approved:
    "Oi {{nome_cliente}}! 🎉\n\nSeu pagamento foi *validado* e o agendamento está confirmado na *{{nome_empresa}}*.\n\n📅 {{data}} às {{horario}}\n💵 Saldo restante: {{saldo_restante}}\n\nAté logo! ✨",
  deposit_rejected:
    "Olá {{nome_cliente}}, tudo bem? ⚠️\n\nTivemos um problema ao validar o comprovante do seu pagamento na *{{nome_empresa}}*.\n\nPor favor, reenvie o comprovante por aqui ou fale conosco pelo {{telefone_empresa}}. 🙏",
  review_request:
    "Oi {{nome_cliente}}! ⭐\n\nGostaríamos da sua avaliação sobre o atendimento na *{{nome_empresa}}*. Leva menos de 1 minuto:\n\n{{link_avaliacao}}\n\nSua opinião ajuda demais! 💛",
  custom:
    "Oi {{nome_cliente}}! 👋\n\nAqui é da *{{nome_empresa}}*.\n\n",
};

export const WA_MESSAGE_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground border-border" },
  opened: { label: "Aberta", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  sent: { label: "Enviada", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  cancelled: { label: "Cancelada", className: "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300 border-neutral-500/30" },
  failed: { label: "Sem telefone", className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
};

/** Substitui as variáveis {{chave}} preservando emojis e quebras de linha. */
export function renderWaTemplate(template: string, vars: WaVars) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`{{\\s*${k}\\s*}}`, "gi"), v ?? ""),
    template,
  );
}

/**
 * Normaliza um telefone brasileiro: remove espaços, parênteses, traços e
 * qualquer caractere especial e adiciona o DDI 55 quando necessário.
 * Ex.: "(17) 99788-6655" → "5517997886655".
 */
export function waDigits(phone: string | null | undefined) {
  let d = (phone ?? "").replace(/\D/g, "");
  if (!d) return "";
  d = d.replace(/^0+/, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.startsWith("55")) return d;
  return d;
}

/** Link oficial do WhatsApp com o texto já codificado (URL encode). */
export function waUrlFor(phone: string | null | undefined, message: string) {
  const num = waDigits(phone);
  const text = encodeURIComponent(message);
  return num ? `https://wa.me/${num}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** Abre o link do WhatsApp (Desktop se instalado, senão WhatsApp Web). */
export function openWhatsApp(phone: string | null | undefined, message: string) {
  window.open(waUrlFor(phone, message), "_blank", "noopener");
}
