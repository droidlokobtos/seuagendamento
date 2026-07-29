import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const companyInput = z.object({ companyId: z.string().uuid() });

/**
 * Inicia a conexão do WhatsApp da empresa.
 * - provedor "manual": a fila fica pronta para envio em 1 clique.
 * - provedores externos: solicita o QR Code / valida credenciais no serviço.
 */
export const connectWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => companyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: integration, error } = await context.supabase
      .from("whatsapp_integrations")
      .select("*")
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!integration) throw new Error("Configure a integração antes de conectar.");

    const now = new Date().toISOString();

    if (integration.provider === "manual") {
      await context.supabase
        .from("whatsapp_integrations")
        .update({
          status: "connected",
          device_name: "WhatsApp Web (envio manual)",
          connected_at: now,
          last_sync_at: now,
          last_activity_at: now,
          last_error: null,
        })
        .eq("company_id", data.companyId);
      return { status: "connected" as const, qr: null as string | null };
    }

    if (!integration.api_url || !integration.api_token) {
      await context.supabase
        .from("whatsapp_integrations")
        .update({ status: "error", last_error: "URL ou token do provedor não informados." })
        .eq("company_id", data.companyId);
      return { status: "error" as const, qr: null, message: "URL ou token do provedor não informados." };
    }

    try {
      const res = await fetch(`${integration.api_url.replace(/\/$/, "")}/session/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${integration.api_token}`,
        },
        body: JSON.stringify({ session: data.companyId }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Provedor respondeu ${res.status}`);
      const status = json?.connected ? "connected" : "pending_qr";
      await context.supabase
        .from("whatsapp_integrations")
        .update({
          status,
          session_ref: json?.session ?? data.companyId,
          device_name: json?.device_name ?? null,
          phone_number: json?.phone ?? null,
          connected_at: json?.connected ? now : null,
          last_sync_at: now,
          last_activity_at: now,
          last_error: null,
        })
        .eq("company_id", data.companyId);
      return { status: status as "connected" | "pending_qr", qr: (json?.qr as string) ?? null };
    } catch (e: any) {
      const message = e?.message ?? "Não foi possível falar com o provedor.";
      await context.supabase
        .from("whatsapp_integrations")
        .update({ status: "error", last_error: message, last_sync_at: now })
        .eq("company_id", data.companyId);
      return { status: "error" as const, qr: null, message };
    }
  });

/**
 * Consulta o estado atual da sessão no bridge (polling do QR Code).
 * Mantém o banco como fonte de verdade do status da sessão da empresa.
 */
export const syncWhatsAppSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => companyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: integration, error } = await context.supabase
      .from("whatsapp_integrations")
      .select("*")
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!integration) throw new Error("Sem acesso à integração desta empresa.");

    if (integration.provider === "manual" || !integration.api_url || !integration.api_token) {
      return { status: integration.status as string, qr: null as string | null };
    }

    const now = new Date().toISOString();
    try {
      const url = new URL(`${integration.api_url.replace(/\/$/, "")}/session/status`);
      url.searchParams.set("session", integration.session_ref ?? data.companyId);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${integration.api_token}` },
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Provedor respondeu ${res.status}`);

      const status = json?.connected ? "connected" : json?.qr ? "pending_qr" : (json?.status ?? "disconnected");
      await context.supabase
        .from("whatsapp_integrations")
        .update({
          status,
          device_name: json?.device_name ?? integration.device_name,
          phone_number: json?.phone ?? integration.phone_number,
          connected_at: json?.connected ? (integration.connected_at ?? now) : null,
          last_sync_at: now,
          last_error: null,
        })
        .eq("company_id", data.companyId);
      return { status: status as string, qr: (json?.qr as string) ?? null };
    } catch (e: any) {
      const message = e?.message ?? "Não foi possível falar com o bridge.";
      await context.supabase
        .from("whatsapp_integrations")
        .update({ status: "error", last_error: message, last_sync_at: now })
        .eq("company_id", data.companyId);
      return { status: "error", qr: null, message };
    }
  });

export const disconnectWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => companyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: integration } = await context.supabase
      .from("whatsapp_integrations")
      .select("provider, api_url, api_token, session_ref")
      .eq("company_id", data.companyId)
      .maybeSingle();

    if (integration && integration.provider !== "manual" && integration.api_url && integration.api_token) {
      try {
        await fetch(`${integration.api_url.replace(/\/$/, "")}/session/stop`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${integration.api_token}`,
          },
          body: JSON.stringify({ session: integration.session_ref ?? data.companyId }),
        });
      } catch {
        /* desconexão local mesmo se o provedor estiver fora do ar */
      }
    }

    const { error } = await context.supabase
      .from("whatsapp_integrations")
      .update({
        status: "disconnected",
        session_ref: null,
        device_name: null,
        phone_number: null,
        connected_at: null,
        last_sync_at: new Date().toISOString(),
      })
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Reprocessa a fila de mensagens pendentes (reenvio automático). */
export const processWhatsAppQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => companyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase
      .from("whatsapp_integrations")
      .select("company_id")
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (!allowed) throw new Error("Sem acesso à integração desta empresa.");
    const { processWaOutbox } = await import("@/lib/whatsapp.server");
    const processed = await processWaOutbox(200);
    return { processed };
  });
