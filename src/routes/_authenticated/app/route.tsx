import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { CompanyProvider, useCompany } from "@/lib/company";
import { AppLayout } from "@/components/app/AppLayout";
import { useRouterState } from "@tanstack/react-router";
import { usePermissions } from "@/lib/use-permissions";
import { routePermission } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppGate,
});

function AppGate() {
  const { loading, isSuperAdmin, companyIds } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isSuperAdmin && companyIds.length === 0) {
      void navigate({ to: "/no-access" as any, replace: true });
    }
  }, [loading, isSuperAdmin, companyIds, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <CompanyProvider>
      <AppShell />
    </CompanyProvider>
  );
}

function AppShell() {
  const { companies, activeCompany, loading } = useCompany();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!companies.length || !activeCompany) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <div className="grid h-14 w-14 mx-auto place-items-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-lg font-semibold">Nenhuma empresa vinculada</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Peça ao administrador para vincular seu usuário a uma empresa.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AppLayout>
      <PermissionGate />
    </AppLayout>
  );
}

function PermissionGate() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { can, loading } = usePermissions();
  const key = routePermission(path);
  if (loading) return null;
  const isDashboard = path === "/app" || path === "/app/";
  if ((!isDashboard && !key) || (key && !can(key))) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="p-8 text-center">
          <h1 className="text-lg font-semibold">Acesso não autorizado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu perfil não tem permissão para acessar esta área. Fale com o administrador da empresa.
          </p>
        </CardContent>
      </Card>
    );
  }
  return <Outlet />;
}
