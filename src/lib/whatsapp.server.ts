/**
 * Núcleo server-side da mensageria WhatsApp.
 *
 * `queueWaEvent` é o único ponto que as regras de negócio usam. Ele resolve o
 * modelo da empresa, renderiza as variáveis e grava a mensagem na fila
 * (`whatsapp_messages`). `dispatchMessage` escolhe o provedor configurado —
 * trocar de provedor não afeta nenhuma outra parte do sistema.
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

type Provider = {
  id: string;
  /** Retorna o status resultante da tentativa de entrega. */
  send: (args: {
    to: string;
    content: string;
    integration: any;
  }) => Promise<{ status: "sent" | "pending" | "failed"; error?: string }>;
};

/** Provedor padrão: não há entrega automática, a mensagem fica pronta na fila. */
const manualProvider: Provider = {
  id: "manual",
  send: async () => ({ status: "pending" }),
};

/** Bridge WhatsApp Web (sessão por QR Code) mantido fora do app. */
const webBridgeProvider: Provider = {
  id: "web_bridge",
  send: async ({ to, content, integration }) => {
    if (!integration?.api_url || !integration?.api_token) {
      return { status: "failed", error: "Bridge não configurado (URL/token ausentes)" };
    }
    try {
      const res = await fetch(`${integration.api_url.replace(/\/$/, "")}/messages/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${integration.api_token}`,
        },
        body: JSON.stringify({
          session: integration.session_ref ?? integration.company_id,
          to,
          text: content,
        }),
      });
      if (!res.ok) return { status: "failed", error: `Bridge respondeu ${res.status}` };
      return { status: "sent" };
    } catch (e: any) {
      return { status: "failed", error: e?.message ?? "Falha de rede com o bridge" };
    }
  },
};

/** API oficial Meta Cloud — mesma interface, plugável sem mudar regras. */
const cloudApiProvider: Provider = {
  id: "cloud_api",
  send: async ({ to, content, integration }) => {
    if (!integration?.api_url || !integration?.api_token) {
      return { status: "failed", error: "Cloud API não configurada" };
    }
    try {
      const res = await fetch(integration.api_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${integration.api_token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { preview_url: true, body: content },
        }),
      });
      if (!res.ok) return { status: "failed", error: `Cloud API respondeu ${res.status}` };
      return { status: "sent" };
    } catch (e: any) {
      return { status: "failed", error: e?.message ?? "Falha de rede com a Cloud API" };
    }
  },
};

const PROVIDERS: Record<string, Provider> = {
  manual: manualProvider,
  web_bridge: webBridgeProvider,
  cloud_api: cloudApiProvider,
};

export function getProvider(id: string | null | undefined): Provider {
  return PROVIDERS[id ?? "manual"] ?? manualProvider;
}

async function loadIntegration(admin: any, companyId: string) {
  const { data } = await admin
    .from("whatsapp_integrations")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  return data;
}

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
 * Enfileira (e tenta entregar) uma mensagem de um evento de negócio.
 * Nunca lança: falhas de mensageria não podem quebrar o fluxo principal.
 */
export async function queueWaEvent(input: QueueInput) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const integration = await loadIntegration(supabaseAdmin, input.companyId);
    if (integration && integration.auto_send_enabled === false) return null;

    const template = await loadTemplate(supabaseAdmin, input.companyId, input.event);
    if (!template) return null;

    const content = renderWaTemplate(template, input.vars);
    const to = waDigits(input.phone);
    const maxAttempts = integration?.max_attempts ?? 3;
    const providerId = integration?.provider ?? "manual";

    const { data: row } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert({
        company_id: input.companyId,
        appointment_id: input.appointmentId ?? null,
        customer_id: input.customerId ?? null,
        event: input.event,
        provider: providerId,
        to_phone: to || null,
        content,
        wa_url: waUrlFor(input.phone, content),
        status: to ? "pending" : "failed",
        error: to ? null : "Cliente sem telefone cadastrado",
        max_attempts: maxAttempts,
        scheduled_for: input.scheduledFor ?? new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    if (row && to && (!input.scheduledFor || new Date(input.scheduledFor) <= new Date())) {
      await dispatchMessage(supabaseAdmin, row.id);
    }
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/** Tenta entregar uma mensagem da fila respeitando o limite de tentativas. */
export async function dispatchMessage(admin: any, messageId: string) {
  const { data: msg } = await admin
    .from("whatsapp_messages")
    .select("*")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg || msg.status === "sent" || msg.status === "delivered" || msg.status === "cancelled") return;

  const integration = await loadIntegration(admin, msg.company_id);
  const provider = getProvider(integration?.provider ?? msg.provider);
  const result = await provider.send({
    to: msg.to_phone ?? "",
    content: msg.content,
    integration,
  });

  const attempts = (msg.attempts ?? 0) + 1;
  const exhausted = attempts >= (msg.max_attempts ?? 3);
  const status =
    result.status === "sent"
      ? "sent"
      : result.status === "pending"
        ? "pending"
        : exhausted
          ? "failed"
          : "pending";

  await admin
    .from("whatsapp_messages")
    .update({
      attempts: result.status === "pending" && provider.id === "manual" ? msg.attempts : attempts,
      status,
      error: result.error ?? null,
      sent_at: result.status === "sent" ? new Date().toISOString() : msg.sent_at,
      provider: provider.id,
    })
    .eq("id", messageId);

  if (result.status === "sent") {
    await admin
      .from("whatsapp_integrations")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("company_id", msg.company_id);
  }
}

/** Reprocessa a fila: usado pelo cron e pelo botão "Processar fila". */
export async function processWaOutbox(limit = 100) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: pending } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("id, attempts, max_attempts, provider")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .limit(limit);

  let processed = 0;
  for (const m of pending ?? []) {
    if ((m as any).provider === "manual") continue; // envio manual pela fila da tela
    await dispatchMessage(supabaseAdmin, m.id);
    processed++;
  }
  return processed;
}
