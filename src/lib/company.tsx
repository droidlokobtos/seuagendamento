import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type Company = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  status: string | null;
  niche_id: string | null;
};

type CompanyCtx = {
  companies: Company[];
  activeCompany: Company | null;
  setActiveCompanyId: (id: string) => void;
  loading: boolean;
};

const Ctx = createContext<CompanyCtx | null>(null);
const KEY = "beauty:activeCompanyId";

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, isSuperAdmin, companyIds } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem(KEY) : null),
  );

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["my-companies", user?.id, isSuperAdmin, companyIds.join(",")],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("companies")
        .select("id,name,slug,logo_url,primary_color,secondary_color,status,niche_id")
        .order("name");
      if (!isSuperAdmin) q = q.in("id", companyIds.length ? companyIds : ["00000000-0000-0000-0000-000000000000"]);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });

  useEffect(() => {
    if (!companies.length) return;
    if (!activeId || !companies.find((c) => c.id === activeId)) {
      const next = companies[0].id;
      setActiveId(next);
      localStorage.setItem(KEY, next);
    }
  }, [companies, activeId]);

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === activeId) ?? null,
    [companies, activeId],
  );

  const value: CompanyCtx = {
    companies,
    activeCompany,
    loading: isLoading,
    setActiveCompanyId: (id) => {
      setActiveId(id);
      localStorage.setItem(KEY, id);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCompany() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCompany must be used inside CompanyProvider");
  return ctx;
}
