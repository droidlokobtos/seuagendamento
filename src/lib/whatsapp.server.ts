/**
 * Núcleo server-side da mensageria WhatsApp — 100% por LINK OFICIAL.
 *
 * `queueWaEvent` é o único ponto usado pelas regras de negócio: resolve o
 * modelo da empresa, renderiza as variáveis e grava a mensagem na fila
 * (`whatsapp_messages`) já com o link `https://wa.me/...` pronto. O envio é
 * feito por um clique do atendente — nenhuma API, token ou sessão externa.
 */
import {
  DEFAULT_TEMPLATES,
  renderWaTemplate,
  waDigits,
  waUrlFor,
  type WaEvent,
  type WaVars,
} from "./whatsapp";

type QueueInput = {
  companyId: string;
  event: WaEvent;
  vars: WaVars;
  phone?: string | null;
  appointmentId?: string | null;
  customerId?: string | null;
  scheduledFor?: string;
};

async function loadTemplate(admin: any, companyId: string, event: WaEvent) {
  const { data } = await admin
    .from("whatsapp_templates")
    .select("body, enabled")
    .eq("company_id", companyId)
    .eq("event", event)
    .maybeSingle();
  if (data && data.enabled === false) return null;
  return data?.body ?? DEFAULT_TEMPLATES[event];
}

/**
 * Enfileira uma mensagem de um evento de negócio com o link pronto.
 * Nunca lança: falhas de mensageria não podem quebrar o fluxo principal.
 */
export async function queueWaEvent(input: QueueInput) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const template = await loadTemplate(supabaseAdmin, input.companyId, input.event);
    if (!template) return null;

    const content = renderWaTemplate(template, input.vars);
    const to = waDigits(input.phone);

    const { data: row } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert({
        company_id: input.companyId,
        appointment_id: input.appointmentId ?? null,
        customer_id: input.customerId ?? null,
        event: input.event,
        provider: "link",
        to_phone: to || null,
        content,
        wa_url: waUrlFor(input.phone, content),
        status: to ? "pending" : "failed",
        error: to ? null : "Cliente sem telefone cadastrado",
        max_attempts: 1,
        scheduled_for: input.scheduledFor ?? new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    return row?.id ?? null;
  } catch {
    return null;
  }
}
