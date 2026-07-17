import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "company_admin" | "staff" | "customer";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  isSuperAdmin: boolean;
  companyIds: string[];
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [companyIds, setCompanyIds] = useState<string[]>([]);

  const loadRoles = async (uid: string | undefined) => {
    if (!uid) {
      setRoles([]);
      setCompanyIds([]);
      return;
    }
    const [{ data: r }, { data: cu }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("company_users").select("company_id").eq("user_id", uid),
    ]);
    setRoles((r ?? []).map((x) => x.role as AppRole));
    setCompanyIds((cu ?? []).map((x) => x.company_id as string));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => void loadRoles(s?.user.id), 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadRoles(data.session?.user.id).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    user: session?.user ?? null,
    session,
    loading,
    roles,
    isSuperAdmin: roles.includes("super_admin"),
    companyIds,
    refresh: async () => loadRoles(session?.user.id),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
