import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
  mustChangePassword: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const loadRoles = async (uid: string | undefined) => {
    if (!uid) {
      setRoles([]); setCompanyIds([]); setMustChangePassword(false);
      return;
    }
    const [{ data: r }, { data: cu }, { data: p }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("company_users").select("company_id").eq("user_id", uid),
      supabase.from("profiles").select("must_change_password").eq("id", uid).maybeSingle(),
    ]);
    setRoles((r ?? []).map((x) => x.role as AppRole));
    setCompanyIds((cu ?? []).map((x) => x.company_id as string));
    setMustChangePassword(!!(p as any)?.must_change_password);
  };

  useEffect(() => {
    let loadedFor: string | null = null;

    const load = (uid: string | undefined) => {
      const key = uid ?? null;
      if (loadedFor === key) return; // já carregado para este usuário
      loadedFor = key;
      void loadRoles(uid);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // TOKEN_REFRESHED (a cada ~1h e ao focar a aba) e INITIAL_SESSION
      // disparavam 3 consultas cada; só recarregamos em troca de identidade.
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setTimeout(() => load(s?.user.id), 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      const uid = data.session?.user.id;
      loadedFor = uid ?? null;
      void loadRoles(uid).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = useMemo(() => ({
    user: session?.user ?? null,
    session,
    loading,
    roles,
    isSuperAdmin: roles.includes("super_admin"),
    companyIds,
    mustChangePassword,
    refresh: async () => loadRoles(session?.user.id),
    signOut: async () => { await supabase.auth.signOut(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [session, loading, roles, companyIds, mustChangePassword]);


  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
