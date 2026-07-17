import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { CompanyProvider, useCompany } from "@/lib/company";
import { AppLayout } from "@/components/app/AppLayout";
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
      <Outlet />
    </AppLayout>
  );
}
