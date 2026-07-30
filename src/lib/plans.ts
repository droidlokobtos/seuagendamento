import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ---------------- Tipos ---------------- */

export type PlanKind = "plan" | "package";
export type CustomerPlanStatus = "active" | "expired" | "cancelled";

export type Plan = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  kind: PlanKind;
  price_cents: number;
  promo_price_cents: number | null;
  valid_until: string | null;
  sessions_total: number | null;
  duration_days: number | null;
  image_url: string | null;
  active: boolean;
  waive_deposit: boolean;
  created_at: string;
};

export type PlanService = {
  id: string;
  plan_id: string;
  company_id: string;
  service_id: string;
  sessions: number;
  notes: string | null;
};

export type CustomerPlan = {
  id: string;
  company_id: string;
  customer_id: string;
  plan_id: string | null;
  plan_name: string;
  kind: PlanKind;
  amount_cents: number;
  payment_method: string | null;
  sold_at: string;
  sold_by: string | null;
  expires_at: string | null;
  waive_deposit: boolean;
  status: CustomerPlanStatus;
  cancelled_at: string | null;
  cancel_reason: string | null;
  notes: string | null;
};

export type CustomerPlanService = {
  id: string;
  customer_plan_id: string;
  company_id: string;
  service_id: string;
  service_name: string | null;
  sessions_total: number;
  sessions_used: number;
  notes: string | null;
};

/* ---------------- Constantes ---------------- */

export const PLAN_KINDS: Record<PlanKind, string> = {
  plan: "Plano",
  package: "Pacote",
};

export const PLAN_STATUS: Record<CustomerPlanStatus, { label: string; className: string }> = {
  active: {
    label: "Ativo",
    className:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  },
  expired: {
    label: "Vencido",
    className:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  },
  cancelled: {
    label: "Cancelado",
    className:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
  },
};

export const PAYMENT_METHODS = [
  "Dinheiro",
  "PIX",
  "Cartão de crédito",
  "Cartão de débito",
  "Transferência",
  "Outro",
];

/* ---------------- Helpers ---------------- */

export const isExpiredPlan = (p: Pick<CustomerPlan, "status" | "expires_at">) =>
  p.status === "expired" || (!!p.expires_at && new Date(p.expires_at) < new Date(new Date().toDateString()));

export const daysUntil = (date: string | null) => {
  if (!date) return null;
  const diff = new Date(date).getTime() - new Date(new Date().toDateString()).getTime();
  return Math.ceil(diff / 86400000);
};

export const effectivePrice = (p: Pick<Plan, "price_cents" | "promo_price_cents">) =>
  p.promo_price_cents && p.promo_price_cents > 0 ? p.promo_price_cents : p.price_cents;

/** Registra uma ação na auditoria do módulo (nunca sobrescreve registros). */
export async function logPlanAudit(entry: {
  company_id: string;
  entity: string;
  entity_id?: string | null;
  action: string;
  description?: string | null;
  old_data?: unknown;
  new_data?: unknown;
}) {
  const { data: auth } = await supabase.auth.getUser();
  await supabase.from("plan_audit_log").insert({
    company_id: entry.company_id,
    entity: entry.entity,
    entity_id: entry.entity_id ?? null,
    action: entry.action,
    description: entry.description ?? null,
    old_data: (entry.old_data ?? null) as never,
    new_data: (entry.new_data ?? null) as never,
    actor_user_id: auth.user?.id ?? null,
  } as never);
}

/* ---------------- Queries ---------------- */

export function usePlans(companyId: string | undefined) {
  return useQuery({
    enabled: !!companyId,
    queryKey: ["plans", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*, plan_services(id,service_id,sessions,notes,services(name))")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useCustomerPlans(companyId: string | undefined) {
  return useQuery({
    enabled: !!companyId,
    queryKey: ["customer-plans", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_plans")
        .select("*, customers(name,phone), customer_plan_services(*)")
        .eq("company_id", companyId!)
        .order("sold_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

/** Planos/pacotes de um cliente específico (ficha do cliente). */
export function useCustomerPlansOf(customerId: string | null) {
  return useQuery({
    enabled: !!customerId,
    queryKey: ["customer-plans-of", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_plans")
        .select("*, customer_plan_services(*)")
        .eq("customer_id", customerId!)
        .order("sold_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function usePlanUsage(customerPlanIds: string[]) {
  return useQuery({
    enabled: customerPlanIds.length > 0,
    queryKey: ["plan-usage", customerPlanIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_session_usage")
        .select("*")
        .in("customer_plan_id", customerPlanIds)
        .order("used_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function usePlanAudit(companyId: string | undefined) {
  return useQuery({
    enabled: !!companyId,
    queryKey: ["plan-audit", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_audit_log")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

/** Indicadores do painel do módulo. */
export function planDashboard(sales: any[]) {
  const today = new Date().toDateString();
  let revenue = 0;
  let plansSold = 0;
  let packagesSold = 0;
  let activePlans = 0;
  let activePackages = 0;
  let remaining = 0;
  let expiringSoon = 0;
  let expired = 0;

  for (const s of sales) {
    revenue += s.amount_cents ?? 0;
    if (s.kind === "plan") plansSold++;
    else packagesSold++;
    const balances = (s.customer_plan_services ?? []) as CustomerPlanService[];
    const isActive = s.status === "active" && !isExpiredPlan(s);
    if (isActive) {
      if (s.kind === "plan") activePlans++;
      else activePackages++;
      remaining += balances.reduce((t, b) => t + Math.max(0, b.sessions_total - b.sessions_used), 0);
      const d = daysUntil(s.expires_at);
      if (d !== null && d >= 0 && d <= 7) expiringSoon++;
    }
    if (s.status !== "cancelled" && isExpiredPlan(s)) expired++;
  }

  return {
    plansSold,
    packagesSold,
    revenue,
    activePlans,
    activePackages,
    remaining,
    expiringSoon,
    expired,
    todayKey: today,
  };
}
