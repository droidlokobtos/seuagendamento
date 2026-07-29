import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ---------------- Constantes ---------------- */

export const ATTENDANCE_EVENTS: Record<string, { label: string; emoji: string; tone: string }> = {
  completed: { label: "Compareceu", emoji: "✅", tone: "text-emerald-600" },
  no_show: { label: "Faltou", emoji: "🚫", tone: "text-destructive" },
  late_cancel: { label: "Cancelou em cima da hora", emoji: "⏰", tone: "text-amber-600" },
  cancelled_by_customer: { label: "Cancelou com antecedência", emoji: "↩️", tone: "text-muted-foreground" },
  cancelled: { label: "Cancelado", emoji: "↩️", tone: "text-muted-foreground" },
  cancelled_by_company: { label: "Cancelado pela empresa", emoji: "🏢", tone: "text-muted-foreground" },
};

export const CLASSIFICATION: Record<
  string,
  { label: string; emoji: string; badge: string; description: string }
> = {
  reliable: {
    label: "Cliente confiável",
    emoji: "🟢",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    description: "Comparece com regularidade.",
  },
  attention: {
    label: "Atenção",
    emoji: "🟡",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    description: "Já teve faltas ou cancelamentos recentes.",
  },
  high_risk: {
    label: "Alto risco",
    emoji: "🔴",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    description: "Histórico frequente de faltas.",
  },
};

export const RISK_ACTIONS: Record<string, string> = {
  none: "Nenhuma restrição",
  require_confirmation: "Exigir confirmação do agendamento",
  require_deposit: "Exigir pagamento antecipado (sinal)",
  block: "Bloquear novos agendamentos online",
};

export const WAITLIST_PERIODS: Record<string, string> = {
  any: "Qualquer horário",
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite",
};

export const WAITLIST_STATUS: Record<string, string> = {
  waiting: "Aguardando",
  notified: "Avisado",
  converted: "Agendado",
  cancelled: "Cancelado",
};

/* ---------------- Tipos ---------------- */

export type AttendanceSettings = {
  company_id: string;
  lookback_days: number;
  late_cancel_hours: number;
  weight_completed: number;
  weight_no_show: number;
  weight_late_cancel: number;
  weight_cancel: number;
  attention_score: number;
  risk_score: number;
  min_no_shows_for_action: number;
  risk_action: string;
  reminder_offsets_hours: number[];
  waitlist_enabled: boolean;
};

export type ReliabilityRow = {
  customer_id: string;
  completed: number;
  no_shows: number;
  late_cancels: number;
  cancels: number;
  total: number;
  attendance_rate: number;
  score: number;
  classification: string;
  last_event_at: string | null;
};

export type AttendanceEvent = {
  id: string;
  company_id: string;
  customer_id: string;
  appointment_id: string | null;
  event: string;
  occurred_at: string;
  scheduled_for: string | null;
  hours_before: number | null;
  amount_cents: number;
  notes: string | null;
};

/* ---------------- Hooks ---------------- */

export function useAttendanceSettings(companyId?: string) {
  return useQuery({
    enabled: !!companyId,
    queryKey: ["attendance-settings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_settings")
        .select("*")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return (data as AttendanceSettings) ?? null;
    },
  });
}

export function useSaveAttendanceSettings(companyId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<AttendanceSettings>) => {
      const { error } = await supabase
        .from("attendance_settings")
        .upsert({ company_id: companyId!, ...patch } as any, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance-settings", companyId] }),
  });
}

/** Pontuação e classificação de todos os clientes da empresa. */
export function useReliability(companyId?: string) {
  return useQuery({
    enabled: !!companyId,
    queryKey: ["attendance-reliability", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("customer_reliability", { _company: companyId! });
      if (error) throw error;
      return (data ?? []) as ReliabilityRow[];
    },
  });
}

/** Eventos de comparecimento da empresa (ou de um cliente). */
export function useAttendanceEvents(companyId?: string, customerId?: string) {
  return useQuery({
    enabled: !!companyId,
    queryKey: ["attendance-events", companyId, customerId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("attendance_events")
        .select("*")
        .eq("company_id", companyId!)
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (customerId) q = q.eq("customer_id", customerId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AttendanceEvent[];
    },
  });
}

/** Histórico de comparecimento de um cliente (usado no perfil). */
export function useCustomerAttendance(customerId?: string) {
  return useQuery({
    enabled: !!customerId,
    queryKey: ["customer-attendance", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_events")
        .select("*")
        .eq("customer_id", customerId!)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AttendanceEvent[];
    },
  });
}

export function useWaitlist(companyId?: string) {
  return useQuery({
    enabled: !!companyId,
    queryKey: ["waitlist", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waitlist_entries")
        .select("*, services(name), staff(name)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

/* ---------------- Cálculos ---------------- */

/** Classificação a partir de eventos locais (perfil do cliente). */
export function summarize(events: AttendanceEvent[], s?: AttendanceSettings | null) {
  const w = {
    ok: s?.weight_completed ?? 4,
    ns: s?.weight_no_show ?? -25,
    lc: s?.weight_late_cancel ?? -12,
    c: s?.weight_cancel ?? -4,
  };
  const relevant = events.filter((e) => e.event !== "cancelled_by_company");
  const completed = relevant.filter((e) => e.event === "completed").length;
  const noShows = relevant.filter((e) => e.event === "no_show").length;
  const lateCancels = relevant.filter((e) => e.event === "late_cancel").length;
  const cancels = relevant.filter((e) => e.event === "cancelled" || e.event === "cancelled_by_customer").length;

  const denom = completed + noShows;
  const rate = denom > 0 ? Math.round((completed * 1000) / denom) / 10 : 100;
  const score = Math.max(
    0,
    Math.min(100, 70 + completed * w.ok + noShows * w.ns + lateCancels * w.lc + cancels * w.c),
  );
  const tAtt = s?.attention_score ?? 70;
  const tRisk = s?.risk_score ?? 40;
  const classification = score < tRisk ? "high_risk" : score < tAtt ? "attention" : "reliable";

  const lostCents = relevant
    .filter((e) => e.event === "no_show" || e.event === "late_cancel")
    .reduce((sum, e) => sum + (e.amount_cents ?? 0), 0);

  return { completed, noShows, lateCancels, cancels, total: relevant.length, rate, score, classification, lostCents };
}
