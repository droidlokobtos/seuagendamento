import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { Building2, LockKeyhole, Loader2 } from "lucide-react";
import { CompanyProvider, useCompany } from "@/lib/company";
import { AppLayout } from "@/components/app/AppLayout";
import { usePermissions } from "@/lib/use-permissions";
import { routeFeature, routePermission } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app")({ component: AppGate });

function AppGate() {
  const { loading, isSuperAdmin, companyIds } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isSuperAdmin && companyIds.length === 0) {
      void navigate({ to: "/onboarding" as any, replace: true });
    }
  }, [loading, isSuperAdmin, companyIds, navigate]);

  if (loading) return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  return <CompanyProvider><AppShell /></CompanyProvider>;
}

function AppShell() {
  const { companies, activeCompany, loading } = useCompany();
  const { isSuperAdmin } = useAuth();

  if (loading) return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!companies.length || !activeCompany) {
    return <div className="min-h-screen grid place-items-center bg-background p-6"><Card className="max-w-md"><CardContent className="p-8 text-center"><div className="grid h-14 w-14 mx-auto place-items-center rounded-2xl bg-primary/10 text-primary"><Building2 className="h-7 w-7" /></div><h1 className="mt-4 text-lg font-semibold">Nenhuma empresa vinculada</h1><p className="mt-2 text-sm text-muted-foreground">Conclua o cadastro da sua empresa para acessar o painel.</p></CardContent></Card></div>;
  }

  const today = new Date().toISOString().slice(0, 10);
  const trialExpired = activeCompany.is_trial && !!activeCompany.trial_ends_at && activeCompany.trial_ends_at < today;
  const blockedStatus = ["suspended", "overdue", "trial_expired"].includes(activeCompany.status ?? "");
  const blocked = !isSuperAdmin && (trialExpired || blockedStatus);

  if (blocked) {
    return <div className="min-h-screen grid place-items-center bg-muted/20 p-6"><Card className="w-full max-w-lg shadow-sm"><CardContent className="p-8 sm:p-10 text-center"><div className="grid h-14 w-14 mx-auto place-items-center rounded-2xl bg-destructive/10 text-destructive"><LockKeyhole className="h-7 w-7" /></div><p className="mt-5 text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">Acesso suspenso</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Seu período de teste terminou</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground">O acesso ao painel foi bloqueado porque não há uma contratação ativa após o período de teste. Seus dados permanecem armazenados. Escolha um plano ou fale com o atendimento para reativar a empresa.</p>{activeCompany.trial_ends_at && <p className="mt-4 text-xs text-muted-foreground">Teste encerrado em {new Date(`${activeCompany.trial_ends_at}T12:00:00`).toLocaleDateString("pt-BR")}.</p>}</CardContent></Card></div>;
  }

  return <AppLayout><PermissionGate /></AppLayout>;
}

function PermissionGate() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isSuperAdmin } = useAuth();
  const { can, hasFeature, loading } = usePermissions();

  if (isSuperAdmin) return <Outlet />;

  const key = routePermission(path);
  const feature = routeFeature(path);
  if (loading) return null;
  const isDashboard = path === "/app" || path === "/app/";
  const permissionDenied = (!isDashboard && !key) || (key && !can(key));
  const planDenied = !!feature && !hasFeature(feature);

  if (permissionDenied || planDenied) {
    return <Card className="max-w-lg mx-auto"><CardContent className="p-8 text-center"><h1 className="text-lg font-semibold">{planDenied ? "Recurso não disponível no seu plano" : "Acesso não autorizado"}</h1><p className="mt-2 text-sm text-muted-foreground">{planDenied ? "Este recurso faz parte de um plano superior. Fale com o administrador para alterar o plano da empresa." : "Seu perfil não tem permissão para acessar esta área. Fale com o administrador da empresa."}</p></CardContent></Card>;
  }
  return <Outlet />;
}
