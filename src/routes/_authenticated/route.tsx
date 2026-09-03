import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const PASSWORD_CHECK_TTL = 60_000;
const passwordCheckCache = new Map<string, { value: boolean; checkedAt: number }>();

async function mustChangePassword(userId: string) {
  const cached = passwordCheckCache.get(userId);
  if (cached && Date.now() - cached.checkedAt < PASSWORD_CHECK_TTL) return cached.value;

  const { data, error } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const value = !!(data as { must_change_password?: boolean } | null)?.must_change_password;
  passwordCheckCache.set(userId, { value, checkedAt: Date.now() });
  return value;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // getSession lê a sessão persistida localmente. As consultas continuam
    // protegidas no backend pelo JWT e pelas políticas RLS do Supabase.
    const { data, error } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (error || !user) throw redirect({ to: "/auth" });
    if (location.pathname !== "/change-password") {
      if (await mustChangePassword(user.id)) {
        throw redirect({ to: "/change-password" });
      }
    }
    return { user };
  },
  component: () => <Outlet />,
});
