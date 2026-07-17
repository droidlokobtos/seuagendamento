import { supabase } from "@/integrations/supabase/client";

const KEY = "beauty:impersonation";
const COMPANY_KEY = "beauty:activeCompanyId";

export function getImpersonation(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function isImpersonating(): boolean {
  return !!getImpersonation();
}

export async function startImpersonation(company: { id: string; name: string }) {
  localStorage.setItem(KEY, company.id);
  localStorage.setItem(COMPANY_KEY, company.id);
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("admin_access_logs").insert({
    user_id: u.user?.id,
    email: u.user?.email,
    event: "impersonation_start",
    user_agent: navigator.userAgent,
    metadata: { company_id: company.id, company_name: company.name },
  });
}

export async function stopImpersonation() {
  const companyId = localStorage.getItem(KEY);
  localStorage.removeItem(KEY);
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("admin_access_logs").insert({
    user_id: u.user?.id,
    email: u.user?.email,
    event: "impersonation_end",
    user_agent: navigator.userAgent,
    metadata: { company_id: companyId },
  });
}
