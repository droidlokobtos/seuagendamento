import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export * from "./anamnesis-core";

/* ---------------- Tipos e queries ---------------- */

export type AnamnesisRecord = {
  id: string;
  company_id: string;
  customer_id: string;
  appointment_id: string | null;
  sections: string[];
  answers: Record<string, any>;
  alerts: string[];
  consent_truth: boolean;
  consent_procedure: boolean;
  consent_lgpd: boolean;
  signature_data: string | null;
  filled_by: string;
  actor_user_id: string | null;
  filled_at: string;
  created_at: string;
};

export function useAnamnesisRecords(customerId: string | null) {
  return useQuery({
    enabled: !!customerId,
    queryKey: ["anamnesis", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anamnesis_records")
        .select("*")
        .eq("customer_id", customerId!)
        .order("filled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AnamnesisRecord[];
    },
  });
}

export function useAnamnesisLog(customerId: string | null) {
  return useQuery({
    enabled: !!customerId,
    queryKey: ["anamnesis-log", customerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("anamnesis_access_log")
        .select("*")
        .eq("customer_id", customerId!)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
}

export async function logAnamnesisAccess(input: {
  companyId: string;
  customerId?: string | null;
  recordId?: string | null;
  action: "view" | "create" | "update" | "delete" | "export";
  detail?: string;
}) {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("anamnesis_access_log").insert({
    company_id: input.companyId,
    customer_id: input.customerId ?? null,
    record_id: input.recordId ?? null,
    action: input.action,
    detail: input.detail ?? null,
    actor_user_id: u?.user?.id ?? null,
  } as any);
}

