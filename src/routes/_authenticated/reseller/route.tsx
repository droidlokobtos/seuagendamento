import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Handshake, LogOut, ShieldCheck } from "lucide-react";
export const Route = createFileRoute("/_authenticated/reseller")({ component: Gate });
function Gate() {
  const { loading, isReseller, isSuperAdmin, user, signOut } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !isReseller && !isSuperAdmin) void nav({ to: "/home" as any, replace: true });
  }, [loading, isReseller, isSuperAdmin, nav]);
  if (loading || (!isReseller && !isSuperAdmin)) return null;
  return (
    <div className="premium-shell min-h-screen">
      <header className="premium-header sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 md:px-8">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Handshake className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold">Portal do Revendedor</p>
          <p className="text-xs text-muted-foreground">
            {isSuperAdmin ? "Visualização administrativa" : "SeuAgendamento"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {isSuperAdmin ? (
            <>
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin Master
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void nav({ to: "/admin/resellers" })}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Admin
              </Button>
            </>
          ) : (
            <>
              <span className="hidden text-xs text-muted-foreground sm:block">{user?.email}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await signOut();
                  void nav({ to: "/auth", replace: true });
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </>
          )}
        </div>
      </header>
      <main className="premium-content p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
