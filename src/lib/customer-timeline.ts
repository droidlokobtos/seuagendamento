import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";

export type TimelineCategory =
  | "cadastro"
  | "agendamentos"
  | "servicos"
  | "produtos"
  | "pagamentos"
  | "financeiro"
  | "whatsapp"
  | "avaliacoes"
  | "observacoes";

export type TimelineEvent = {
  id: string;
  at: string; // ISO
  icon: string;
  title: string;
  description?: string | null;
  detail?: string | null;
  actor?: string | null;
  category: TimelineCategory;
  amountCents?: number | null;
  tone?: "default" | "success" | "danger" | "warning";
};

export const TIMELINE_FILTERS: { key: "todos" | TimelineCategory; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "agendamentos", label: "Agendamentos" },
  { key: "financeiro", label: "Financeiro" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "servicos", label: "Serviços" },
  { key: "produtos", label: "Produtos" },
  { key: "pagamentos", label: "Pagamentos" },
  { key: "avaliacoes", label: "Avaliações" },
  { key: "observacoes", label: "Observações" },
];

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  email: "E-mail",
  birthdate: "Aniversário",
  notes: "Observações",
  preferred_staff_id: "Profissional preferido",
  communication_pref: "Preferência de contato",
  restrictions: "Restrições",
  general_notes: "Observações gerais",
  content: "Texto",
  pinned: "Fixada",
};

const PAYMENT_KIND: Record<string, { icon: string; label: string }> = {
  deposit: { icon: "🏦", label: "Pagamento antecipado (sinal)" },
  final: { icon: "💰", label: "Pagamento recebido" },
  extra: { icon: "💰", label: "Acréscimo pago" },
  refund: { icon: "↩️", label: "Estorno" },
};

const MESSAGE_KIND: Record<string, string> = {
  confirmation: "Confirmação",
  reminder: "Lembrete",
  review: "Avaliação",
  billing: "Cobrança",
  custom: "Personalizada",
  birthday: "Aniversário",
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
  cancelled_by_customer: "Cancelado pelo cliente",
  cancelled_by_company: "Cancelado pela empresa",
};

function dt(v: string) {
  return new Date(v).toISOString();
}

export function useCustomerTimeline(
  customerId: string | null,
  customer?: { name: string; created_at: string } | null,
) {
  return useQuery({
    enabled: !!customerId,
    queryKey: ["customer-timeline", customerId],
    queryFn: async (): Promise<TimelineEvent[]> => {
      const cid = customerId!;
      const events: TimelineEvent[] = [];

      const [apptRes, historyRes, reviewsRes, commissionsRes, waRes] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id,created_at,starts_at,ends_at,status,total_cents,discount_cents,surcharge_cents,notes,staff(name),appointment_services(price_cents,services(name))",
          )
          .eq("customer_id", cid)
          .order("starts_at", { ascending: false })
          .limit(200),
        supabase
          .from("customer_profile_history")
          .select("*")
          .eq("customer_id", cid)
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("reviews")
          .select("id,rating,staff_rating,comment,created_at,service_names,staff(name)")
          .eq("customer_id", cid)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("commissions")
          .select("id,staff_name,service_name,commission_cents,status,occurred_at")
          .eq("customer_id", cid)
          .order("occurred_at", { ascending: false })
          .limit(200),
        supabase
          .from("whatsapp_messages")
          .select("id,event,status,to_phone,content,sent_at,created_at,scheduled_for")
          .eq("customer_id", cid)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      const appts = (apptRes.data ?? []) as any[];
      const apptIds = appts.map((a) => a.id);
      const apptById = new Map(appts.map((a) => [a.id, a]));

      const [paymentsRes, auditRes, confirmRes, movRes] = await Promise.all([
        apptIds.length
          ? supabase
              .from("appointment_payments")
              .select("id,appointment_id,kind,amount_cents,status,method,notes,reject_reason,created_at,reviewed_at")
              .in("appointment_id", apptIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        apptIds.length
          ? supabase
              .from("financial_audit_log")
              .select("id,appointment_id,action,description,amount_cents,created_at")
              .in("appointment_id", apptIds)
              .order("created_at", { ascending: false })
              .limit(400)
          : Promise.resolve({ data: [] as any[] }),
        apptIds.length
          ? supabase
              .from("appointment_confirmations")
              .select("id,appointment_id,channel,status,sent_at,responded_at,response,cancel_reason,created_at")
              .in("appointment_id", apptIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        apptIds.length
          ? supabase
              .from("inventory_movements")
              .select("id,appointment_id,type,quantity,unit_cost,reason,created_at,products(name,sale_price,unit)")
              .in("appointment_id", apptIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
      ]);

      /* -------- Cadastro -------- */
      if (customer?.created_at) {
        events.push({
          id: `cust-created`,
          at: dt(customer.created_at),
          icon: "👤",
          title: "Cliente cadastrado",
          description: customer.name,
          category: "cadastro",
        });
      }

      /* -------- Agendamentos + serviços -------- */
      for (const a of appts) {
        const services = (a.appointment_services ?? []).map((s: any) => s.services?.name).filter(Boolean);
        const total = (a.total_cents ?? 0) - (a.discount_cents ?? 0) + (a.surcharge_cents ?? 0);
        const when = new Date(a.starts_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

        events.push({
          id: `appt-${a.id}`,
          at: dt(a.created_at),
          icon: "📅",
          title: "Agendamento criado",
          description: `${services.join(", ") || "Serviço"} • ${when}`,
          detail: a.staff?.name ? `Profissional: ${a.staff.name}` : null,
          amountCents: total,
          category: "agendamentos",
        });

        if (a.status === "completed") {
          events.push({
            id: `appt-done-${a.id}`,
            at: dt(a.ends_at ?? a.starts_at),
            icon: "✔️",
            title: "Atendimento concluído",
            description: `Término às ${new Date(a.ends_at ?? a.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
            category: "agendamentos",
            tone: "success",
          });
          for (const s of a.appointment_services ?? []) {
            if (!s.services?.name) continue;
            events.push({
              id: `svc-${a.id}-${s.services.name}`,
              at: dt(a.ends_at ?? a.starts_at),
              icon: "💇",
              title: "Serviço realizado",
              description: s.services.name,
              detail: a.staff?.name ? `Profissional: ${a.staff.name}` : null,
              amountCents: s.price_cents,
              category: "servicos",
            });
          }
        }
      }

      /* -------- Auditoria financeira (status, início, comissões) -------- */
      for (const l of (auditRes.data ?? []) as any[]) {
        if (l.action === "appointment_created") continue; // já coberto
        const a = apptById.get(l.appointment_id);
        let icon = "🧾";
        let title = "Movimentação";
        let category: TimelineCategory = "financeiro";
        let tone: TimelineEvent["tone"] = "default";

        if (l.action === "appointment_status") {
          const desc: string = l.description ?? "";
          category = "agendamentos";
          if (desc.includes("in_progress")) { icon = "▶️"; title = "Atendimento iniciado"; }
          else if (desc.includes("→ confirmed")) { icon = "✅"; title = "Agendamento confirmado"; tone = "success"; }
          else if (desc.includes("cancelled")) { icon = "❌"; title = "Agendamento cancelado"; tone = "danger"; }
          else if (desc.includes("no_show")) { icon = "🚫"; title = "Cliente não compareceu"; tone = "warning"; }
          else if (desc.includes("→ completed")) continue;
          else {
            icon = "🔄";
            title = "Status alterado";
            const [from, to] = desc.replace("Status: ", "").split("→").map((s) => s.trim());
            events.push({
              id: `log-${l.id}`,
              at: dt(l.created_at),
              icon,
              title,
              description: `De: ${STATUS_LABEL[from] ?? from} → Para: ${STATUS_LABEL[to] ?? to}`,
              category,
            });
            continue;
          }
        } else if (l.action === "commission_generated") {
          icon = "💼";
          title = "Comissão gerada";
          category = "financeiro";
        } else if (l.action?.startsWith("payment") || l.action?.startsWith("deposit")) {
          continue; // coberto por appointment_payments
        }

        events.push({
          id: `log-${l.id}`,
          at: dt(l.created_at),
          icon,
          title,
          description: l.description,
          detail: a ? `Agendamento de ${new Date(a.starts_at).toLocaleDateString("pt-BR")}` : null,
          amountCents: l.action === "commission_generated" ? l.amount_cents : null,
          category,
          tone,
        });
      }

      /* -------- Pagamentos -------- */
      for (const p of (paymentsRes.data ?? []) as any[]) {
        const meta = PAYMENT_KIND[p.kind] ?? { icon: "💰", label: "Pagamento" };
        const statusLabel =
          p.status === "approved" ? "Aprovado" : p.status === "rejected" ? "Rejeitado" : "Aguardando aprovação";
        events.push({
          id: `pay-${p.id}`,
          at: dt(p.reviewed_at ?? p.created_at),
          icon: meta.icon,
          title: meta.label,
          description: `${statusLabel}${p.method ? ` • ${p.method}` : ""}`,
          detail: p.reject_reason ? `Motivo: ${p.reject_reason}` : p.notes,
          amountCents: p.kind === "refund" ? -p.amount_cents : p.amount_cents,
          category: "pagamentos",
          tone: p.status === "approved" ? "success" : p.status === "rejected" ? "danger" : "warning",
        });
      }

      /* -------- Comissões -------- */
      for (const c of (commissionsRes.data ?? []) as any[]) {
        events.push({
          id: `com-${c.id}`,
          at: dt(c.occurred_at),
          icon: "💼",
          title: "Comissão gerada",
          description: `${c.staff_name ?? "Profissional"}${c.service_name ? ` • ${c.service_name}` : ""}`,
          detail: c.status === "paid" ? "Paga" : "Pendente",
          amountCents: c.commission_cents,
          category: "financeiro",
        });
      }

      /* -------- Produtos -------- */
      for (const m of (movRes.data ?? []) as any[]) {
        if (!m.products?.name) continue;
        events.push({
          id: `mov-${m.id}`,
          at: dt(m.created_at),
          icon: "🛍️",
          title: m.type === "out" ? "Venda / uso de produto" : "Movimentação de produto",
          description: `${m.products.name} • ${m.quantity} ${m.products.unit ?? "un"}`,
          detail: m.reason,
          amountCents: Math.round((m.products.sale_price ?? 0) * 100 * Number(m.quantity || 0)) || null,
          category: "produtos",
        });
      }

      /* -------- Confirmações / mensagens -------- */
      for (const c of (confirmRes.data ?? []) as any[]) {
        if (c.sent_at || c.status === "sent") {
          events.push({
            id: `conf-${c.id}`,
            at: dt(c.sent_at ?? c.created_at),
            icon: "📲",
            title: "Confirmação enviada",
            description: `Canal: ${c.channel ?? "WhatsApp"}`,
            category: "whatsapp",
          });
        }
        if (c.responded_at) {
          const ok = c.response === "confirmed";
          events.push({
            id: `conf-r-${c.id}`,
            at: dt(c.responded_at),
            icon: ok ? "✅" : "❌",
            title: ok ? "Agendamento confirmado pelo cliente" : "Cancelado pelo cliente",
            description: c.cancel_reason ? `Motivo: ${c.cancel_reason}` : null,
            category: "agendamentos",
            tone: ok ? "success" : "danger",
          });
        }
      }

      for (const w of (waRes.data ?? []) as any[]) {
        events.push({
          id: `wa-${w.id}`,
          at: dt(w.sent_at ?? w.created_at),
          icon: "📲",
          title: `Mensagem • ${MESSAGE_KIND[w.event] ?? w.event}`,
          description: w.status === "sent" ? "Enviada" : w.status === "failed" ? "Falhou" : "Na fila",
          detail: (w.content ?? "").slice(0, 160),
          category: "whatsapp",
          tone: w.status === "failed" ? "danger" : "default",
        });
      }

      /* -------- Avaliações -------- */
      for (const r of (reviewsRes.data ?? []) as any[]) {
        events.push({
          id: `rev-${r.id}`,
          at: dt(r.created_at),
          icon: "⭐",
          title: `Cliente avaliou com ${r.rating} estrela${r.rating > 1 ? "s" : ""}`,
          description: r.service_names || (r.staff?.name ? `Profissional: ${r.staff.name}` : null),
          detail: r.comment,
          category: "avaliacoes",
          tone: r.rating >= 4 ? "success" : r.rating <= 2 ? "danger" : "warning",
        });
      }

      /* -------- Observações e alterações cadastrais -------- */
      for (const h of (historyRes.data ?? []) as any[]) {
        const field = h.field ? FIELD_LABELS[h.field] ?? h.field : null;
        if (h.entity === "note") {
          events.push({
            id: `hist-${h.id}`,
            at: dt(h.created_at),
            icon: "📝",
            title:
              h.action === "created" ? "Observação adicionada" : h.action === "updated" ? "Observação alterada" : "Observação removida",
            description: h.new_value ?? h.old_value,
            detail: h.old_value && h.new_value ? `Antes: ${h.old_value}` : null,
            category: "observacoes",
          });
        } else if (h.entity === "date") {
          events.push({
            id: `hist-${h.id}`,
            at: dt(h.created_at),
            icon: "🎂",
            title: "Data importante " + (h.action === "created" ? "registrada" : h.action === "updated" ? "alterada" : "removida"),
            description: h.new_value ?? h.old_value,
            category: "observacoes",
          });
        } else if (h.entity === "customer" && h.action === "created") {
          continue; // já temos o evento de cadastro
        } else {
          events.push({
            id: `hist-${h.id}`,
            at: dt(h.created_at),
            icon: "✏️",
            title: "Alteração cadastral",
            description: field ? `${field}` : "Perfil atualizado",
            detail:
              h.old_value || h.new_value
                ? `De: ${h.old_value || "—"} → Para: ${h.new_value || "—"}`
                : null,
            category: "cadastro",
          });
        }
      }

      return events
        .filter((e) => !!e.at)
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    },
  });
}

export function eventAmountLabel(cents?: number | null) {
  if (cents === null || cents === undefined || cents === 0) return null;
  return brl(cents / 100);
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Hoje";
  if (same(d, yesterday)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}
