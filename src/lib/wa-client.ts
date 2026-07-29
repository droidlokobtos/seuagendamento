/**
 * Camada cliente da mensageria por link oficial do WhatsApp.
 * Nenhuma API externa: monta a mensagem a partir do modelo da empresa,
 * registra na fila e abre o `https://wa.me/...`.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { computeFinance } from "@/lib/finance";
import {
  DEFAULT_TEMPLATES,
  renderWaTemplate,
  waDigits,
  waUrlFor,
  type WaEvent,
  type WaVars,
} from "@/lib/whatsapp";

export type WaTemplateRow = { id?: string; event: string; body: string; enabled: boolean };

/** Modelos da empresa (com fallback para os modelos padrão). */
export function useWaTemplates(companyId?: string) {
  return useQuery({
    queryKey: ["wa-templates", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_templates")
        .select("id,event,body,enabled")
        .eq("company_id", companyId!);
      const map: Record<string, WaTemplateRow> = {};
      for (const t of data ?? []) map[t.event] = t as WaTemplateRow;
      return map;
    },
  });
}

export function templateBody(
  templates: Record<string, WaTemplateRow> | undefined,
  event: WaEvent,
) {
  return templates?.[event]?.body ?? DEFAULT_TEMPLATES[event];
}

const fmtDate = (d: Date) => d.toLocaleDateString("pt-BR");
const fmtTime = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Monta as variáveis a partir do agendamento + empresa. */
export function buildWaVars(opts: {
  company?: any;
  appointment?: any;
  customerName?: string | null;
  reviewLink?: string | null;
}): WaVars {
  const { company, appointment: a } = opts;
  const dt = a?.starts_at ? new Date(a.starts_at) : null;
  const services =
    (a?.appointment_services ?? [])
      .map((x: any) => x.services?.name)
      .filter(Boolean)
      .join(", ") || "—";
  const f = a
    ? computeFinance({
        subtotalCents: a.total_cents ?? 0,
        discountCents: a.discount_cents ?? 0,
        surchargeCents: a.surcharge_cents ?? 0,
        paidCents: a.paid_cents ?? 0,
        depositRequiredCents: a.deposit_required_cents ?? 0,
      })
    : null;

  return {
    nome_cliente: opts.customerName ?? a?.customers?.name ?? "cliente",
    nome_empresa: company?.name ?? "",
    servico: services,
    profissional: a?.staff?.name ?? "—",
    data: dt ? fmtDate(dt) : "",
    horario: dt ? fmtTime(dt) : "",
    valor: f ? brl(f.totalCents / 100) : "",
    valor_sinal: f ? brl(f.depositRequiredCents / 100) : "",
    saldo_restante: f ? brl(f.balanceCents / 100) : "",
    chave_pix: company?.pix_key ?? "",
    telefone_empresa: company?.whatsapp || company?.phone || "",
    endereco_empresa: company?.address ?? "",
    observacoes: a?.notes ?? "",
    link_avaliacao: opts.reviewLink ?? "",
    link_confirmacao: "",
  };
}

export function renderWaMessage(
  templates: Record<string, WaTemplateRow> | undefined,
  event: WaEvent,
  vars: WaVars,
) {
  return renderWaTemplate(templateBody(templates, event), vars);
}

/** Busca (ou monta) o link de avaliação do atendimento. */
export async function resolveReviewLink(appointmentId?: string | null, slug?: string | null) {
  if (typeof window === "undefined") return "";
  const origin = window.location.origin;
  if (appointmentId) {
    const { data } = await supabase
      .from("review_invites")
      .select("token")
      .eq("appointment_id", appointmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.token) return `${origin}/avaliacao/${data.token}`;
    if (slug) return `${origin}/b/${slug}/avaliar/${appointmentId}`;
  }
  return slug ? `${origin}/b/${slug}` : origin;
}

/** Registra a mensagem na fila e abre o link oficial do WhatsApp. */
export async function sendWaLink(opts: {
  companyId: string;
  event: WaEvent;
  content: string;
  phone?: string | null;
  appointmentId?: string | null;
  customerId?: string | null;
  open?: boolean;
  queryClient?: ReturnType<typeof useQueryClient>;
}) {
  const to = waDigits(opts.phone);
  const url = waUrlFor(opts.phone, opts.content);
  await supabase.from("whatsapp_messages").insert({
    company_id: opts.companyId,
    appointment_id: opts.appointmentId ?? null,
    customer_id: opts.customerId ?? null,
    event: opts.event,
    provider: "link",
    to_phone: to || null,
    content: opts.content,
    wa_url: url,
    status: to ? (opts.open === false ? "pending" : "opened") : "failed",
    error: to ? null : "Cliente sem telefone cadastrado",
    max_attempts: 1,
    scheduled_for: new Date().toISOString(),
    sent_at: null,
  });
  opts.queryClient?.invalidateQueries({ queryKey: ["wa-queue", opts.companyId] });
  if (opts.open !== false) window.open(url, "_blank", "noopener");
  return url;
}
