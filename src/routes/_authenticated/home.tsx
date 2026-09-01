import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({ component: Redirector });

function Redirector() {
  const { loading, isSuperAdmin, companyIds } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (isSuperAdmin) void navigate({ to: "/admin", replace: true });
    else if (companyIds.length > 0) void navigate({ to: "/app", replace: true });
    else void navigate({ to: "/onboarding" as any, replace: true });
  }, [loading, isSuperAdmin, companyIds, navigate]);

  return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
}
