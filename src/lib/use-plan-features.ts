import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { useAuth } from "@/lib/auth";

export type PlanFeatures = Record<string, boolean>;

export function usePlanFeatures() {
  const { activeCompany } = useCompany();
  const { isSuperAdmin } = useAuth();
  const planCode = activeCompany?.plan_code ?? null;

  const query = useQuery({
    queryKey: ["plan-features", activeCompany?.id, planCode],
    enabled: !!activeCompany?.id && !!planCode && !isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("features,max_users")
        .eq("code", planCode!)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return {
        features: ((data?.features ?? {}) as PlanFeatures),
        maxUsers: data?.max_users ?? null,
      };
    },
    staleTime: 5 * 60_000,
  });

  const unrestricted = isSuperAdmin || !planCode;
  const features = unrestricted ? ({ all: true } as PlanFeatures) : (query.data?.features ?? {});

  const hasFeature = (key: string) =>
    unrestricted || features.all === true || features[key] === true;

  return {
    loading: !unrestricted && query.isLoading,
    planCode,
    features,
    maxUsers: unrestricted ? null : (query.data?.maxUsers ?? null),
    hasFeature,
  };
}

export const PERMISSION_FEATURE: Partial<Record<string, string>> = {
  dashboard: "dashboard",
  agenda: "agenda",
  agendamentos: "agendamentos",
  historico: "agendamentos",
  clientes: "clientes",
  clientes_cadastro: "clientes",
  ver_contato_cliente: "clientes",
  financeiro: "financeiro",
  caixa: "caixa",
  servicos: "servicos",
  produtos: "produtos",
  estoque: "estoque",
  relatorios: "relatorios",
  comissoes: "comissoes",
  desempenho: "relatorios_avancados",
};
