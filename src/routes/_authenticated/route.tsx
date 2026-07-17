import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    if (location.pathname !== "/change-password") {
      const { data: p } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", data.user.id)
        .maybeSingle();
      if ((p as any)?.must_change_password) {
        throw redirect({ to: "/change-password" as any });
      }
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
