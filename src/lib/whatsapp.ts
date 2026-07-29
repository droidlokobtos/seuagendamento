/**
 * Camada de abstração de mensageria WhatsApp.
 *
 * As regras de negócio do sistema nunca falam diretamente com um provedor:
 * elas apenas enfileiram um EVENTO com suas variáveis. A entrega é resolvida
 * pelo provedor configurado da empresa (hoje "manual" via link wa.me; no
 * futuro um bridge WhatsApp Web, Evolution/Z-API ou a Meta Cloud API),
 * sem alterar nada fora de `whatsapp-provider.server.ts`.
 */

export type WaEvent =
  | "appointment_created"
  | "appointment_confirmed"
  | "deposit_required"
  | "deposit_approved"
  | "deposit_rejected"
  | "reminder"
  | "appointment_cancelled"
  | "appointment_rescheduled"
  | "appointment_completed"
  | "review_request";

export const WA_EVENTS: { id: WaEvent; label: string; description: string }[] = [
  { id: "appointment_created", label: "Agendamento realizado", description: "Enviado assim que o cliente agenda." },
  { id: "appointment_confirmed", label: "Agendamento confirmado", description: "Enviado quando o horário é confirmado." },
  { id: "deposit_required", label: "Pagamento antecipado obrigatório", description: "Instruções de PIX, sinal e saldo." },
  { id: "deposit_approved", label: "Pagamento aprovado", description: "Comprovante validado, vaga garantida." },
  { id: "deposit_rejected", label: "Pagamento recusado", description: "Problema na validação do comprovante." },
  { id: "reminder", label: "Lembrete automático", description: "Enviado conforme os horários configurados." },
  { id: "appointment_cancelled", label: "Cancelamento", description: "Enviado quando o agendamento é cancelado." },
  { id: "appointment_rescheduled", label: "Reagendamento", description: "Novas informações do agendamento." },
  { id: "appointment_completed", label: "Atendimento concluído", description: "Agradecimento pós-atendimento." },
  { id: "review_request", label: "Solicitação de avaliação", description: "Link de avaliação gerado pelo sistema." },
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
    "Olá {{nome_cliente}}! 👋\n\nSeu agendamento na *{{nome_empresa}}* foi realizado com sucesso.\n\n💈 Serviço: {{servico}}\n👨‍🔧 Profissional: {{profissional}}\n📅 Data: {{data}}\n🕒 Horário: {{horario}}\n📍 Endereço: {{endereco_empresa}}\n📝 Observações: {{observacoes}}\n\nQualquer dúvida, é só responder por aqui. Até breve! ✨",
  appointment_confirmed:
    "Oi {{nome_cliente}}! ✅\n\nSeu horário na *{{nome_empresa}}* está *confirmado*.\n\n📅 {{data}} às {{horario}}\n💈 {{servico}} com {{profissional}}\n\nTe esperamos! 💛",
  deposit_required:
    "Olá {{nome_cliente}}! 💳\n\nPara garantir sua vaga na *{{nome_empresa}}*, é necessário o pagamento antecipado do sinal.\n\n💰 Valor total: {{valor}}\n🔒 Sinal: {{valor_sinal}}\n💵 Restante no atendimento: {{saldo_restante}}\n\n🔑 Chave PIX: {{chave_pix}}\n\nApós o pagamento, envie o comprovante aqui mesmo neste WhatsApp. 📎\nSem a confirmação do sinal o horário pode ser liberado.",
  deposit_approved:
    "Oi {{nome_cliente}}! 🎉\n\nSeu pagamento foi *validado* e o agendamento está confirmado na *{{nome_empresa}}*.\n\n📅 {{data}} às {{horario}}\n💵 Saldo restante: {{saldo_restante}}\n\nAté logo! ✨",
  deposit_rejected:
    "Olá {{nome_cliente}}, tudo bem? ⚠️\n\nTivemos um problema ao validar o comprovante do seu pagamento na *{{nome_empresa}}*.\n\nPor favor, reenvie o comprovante por aqui ou entre em contato pelo {{telefone_empresa}} para regularizarmos seu horário. 🙏",
  reminder:
    "Oi {{nome_cliente}}! ⏰\n\nLembrando do seu horário na *{{nome_empresa}}*.\n\n📅 {{data}} às {{horario}}\n💈 {{servico}} com {{profissional}}\n📍 {{endereco_empresa}}\n\nSe precisar remarcar, é só avisar. Até já! 💇",
  appointment_cancelled:
    "Olá {{nome_cliente}}. ❌\n\nSeu agendamento na *{{nome_empresa}}* do dia {{data}} às {{horario}} foi *cancelado*.\n\nQuer escolher um novo horário? Me avise por aqui que eu te ajudo. 🗓️",
  appointment_rescheduled:
    "Oi {{nome_cliente}}! 🔄\n\nSeu agendamento na *{{nome_empresa}}* foi remarcado.\n\n📅 Nova data: {{data}}\n🕒 Novo horário: {{horario}}\n💈 {{servico}} com {{profissional}}\n📍 {{endereco_empresa}}\n\nAté breve! ✨",
  appointment_completed:
    "Oi {{nome_cliente}}! 💛\n\nObrigado por escolher a *{{nome_empresa}}* hoje. Foi um prazer te atender!\n\nEsperamos você em breve. ✨",
  review_request:
    "Oi {{nome_cliente}}! ⭐\n\nQue tal avaliar seu atendimento na *{{nome_empresa}}*? Leva menos de 1 minuto:\n\n{{link_avaliacao}}\n\nSua opinião ajuda demais! 💛",
};

export const WA_PROVIDERS: { id: string; label: string; hint: string; available: boolean }[] = [
  {
    id: "manual",
    label: "Manual (link WhatsApp Web)",
    hint: "As mensagens ficam na fila prontas para envio em 1 clique. Não exige contratação.",
    available: true,
  },
  {
    id: "web_bridge",
    label: "Bridge WhatsApp Web (sessão por QR Code)",
    hint: "Requer um serviço bridge próprio rodando 24/7 (whatsapp-web.js/Baileys). Informe URL e token.",
    available: false,
  },
  {
    id: "cloud_api",
    label: "Meta WhatsApp Business Cloud API",
    hint: "API oficial. Informe a URL da API e o token permanente.",
    available: false,
  },
];

export const WA_STATUS: Record<string, { label: string; className: string }> = {
  disconnected: { label: "Desconectado", className: "bg-muted text-muted-foreground border-border" },
  pending_qr: { label: "Aguardando leitura do QR Code", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  connected: { label: "Conectado", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  expired: { label: "Sessão expirada", className: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30" },
  error: { label: "Erro na conexão", className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
};

export const WA_MESSAGE_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground border-border" },
  sent: { label: "Enviada", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30" },
  delivered: { label: "Entregue", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  failed: { label: "Falhou", className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
  cancelled: { label: "Cancelada", className: "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300 border-neutral-500/30" },
};

export const REMINDER_OFFSET_OPTIONS = [
  { hours: 24, label: "24 horas antes" },
  { hours: 12, label: "12 horas antes" },
  { hours: 2, label: "2 horas antes" },
  { hours: 1, label: "1 hora antes" },
];

/** Substitui as variáveis {{chave}} preservando emojis e quebras de linha. */
export function renderWaTemplate(template: string, vars: WaVars) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`{{\\s*${k}\\s*}}`, "gi"), v ?? ""),
    template,
  );
}

/** Normaliza um telefone brasileiro para envio (somente dígitos com DDI 55). */
export function waDigits(phone: string | null | undefined) {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("55")) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

export function waUrlFor(phone: string | null | undefined, message: string) {
  const num = waDigits(phone);
  const text = encodeURIComponent(message);
  return num
    ? `https://api.whatsapp.com/send?phone=${num}&text=${text}`
    : `https://api.whatsapp.com/send?text=${text}`;
}
