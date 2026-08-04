import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { PermissionMap } from "@/lib/permissions";

export type AppRole = "super_admin" | "company_admin" | "staff" | "customer" | "receptionist";

export type Membership = {
  companyId: string;
  role: AppRole;
  permissions: PermissionMap;
  active: boolean;
  staffId: string | null;
};

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  isSuperAdmin: boolean;
  companyIds: string[];
  memberships: Membership[];
  mustChangePassword: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const loadRoles = async (uid: string | undefined) => {
    if (!uid) {
      setRoles([]); setMemberships([]); setMustChangePassword(false);
      return;
    }
    const [{ data: r }, { data: cu }, { data: p }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase
        .from("company_users")
        .select("company_id,role,permissions,active,staff_id")
        .eq("user_id", uid),
      supabase.from("profiles").select("must_change_password").eq("id", uid).maybeSingle(),
    ]);
    setRoles((r ?? []).map((x) => x.role as AppRole));
    setMemberships(
      ((cu ?? []) as any[])
        .filter((x) => x.active !== false)
        .map((x) => ({
          companyId: x.company_id as string,
          role: (x.role ?? "staff") as AppRole,
          permissions: (x.permissions ?? {}) as PermissionMap,
          active: x.active !== false,
          staffId: (x.staff_id ?? null) as string | null,
        })),
    );
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
    companyIds: memberships.map((m) => m.companyId),
    memberships,
    mustChangePassword,
    refresh: async () => loadRoles(session?.user.id),
    signOut: async () => { await supabase.auth.signOut(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [session, loading, roles, memberships, mustChangePassword]);


  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
