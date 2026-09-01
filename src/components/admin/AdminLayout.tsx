import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Building2, Tag, CreditCard, Settings, LogOut, Sparkles, Menu, ShieldCheck, Layers3, Mail } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/companies", label: "Empresas", icon: Building2 },
  { to: "/admin/plans", label: "Planos", icon: Layers3 },
  { to: "/admin/niches", label: "Nichos", icon: Tag },
  { to: "/admin/payments", label: "Pagamentos", icon: CreditCard },
  { to: "/admin/logs", label: "Logs de acesso", icon: ShieldCheck },
  { to: "/admin/settings", label: "Configurações", icon: Settings },
];

export function AdminLayout({ children }: { children?: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const email = user?.email ?? "E-mail não disponível";
  const displayName = user?.user_metadata?.full_name ?? "Admin Master";

  const isActive = (to: string, end?: boolean) => (end ? path === to : path === to || path.startsWith(to + "/"));

  const NavList = () => (
    <nav className="flex flex-col gap-0.5 p-2">
      {NAV.map((item) => {
        const active = isActive(item.to, item.end);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const AccountSummary = ({ compact = false }: { compact?: boolean }) => (
    <div className={compact ? "px-3 py-3" : "mb-2 px-1"}>
      <p className="text-xs font-semibold truncate">{displayName}</p>
      <div className="mt-1 flex items-center gap-1.5 min-w-0 text-muted-foreground">
        <Mail className="h-3.5 w-3.5 shrink-0" />
        <p className="text-[11px] truncate" title={email}>{email}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex md:w-64 shrink-0 border-r border-border/60 bg-card/50 flex-col">
        <div className="min-h-16 flex items-center gap-2 px-4 py-3 border-b border-border/60">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">BeautySaaS</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Admin Master</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground truncate" title={email}>{email}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto"><NavList /></div>
        <div className="border-t border-border/60 p-3">
          <AccountSummary />
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={async () => { await signOut(); void navigate({ to: "/auth", replace: true }); }}><LogOut className="h-4 w-4 mr-2" /> Sair</Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="min-h-16 border-b border-border/60 bg-card/40 backdrop-blur flex items-center gap-3 px-4 md:px-6 py-2 sticky top-0 z-30">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild><Button variant="ghost" size="icon" className="md:hidden"><Menu className="h-5 w-5" /></Button></SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden">
              <div className="min-h-16 shrink-0 flex items-center gap-2 px-4 py-3 border-b">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">BeautySaaS</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Admin Master</p>
                  <p className="text-[10px] text-muted-foreground truncate" title={email}>{email}</p>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}><NavList /></div>
              <div className="shrink-0 border-t border-border/60 p-2">
                <AccountSummary compact />
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={async () => { await signOut(); setOpen(false); void navigate({ to: "/auth", replace: true }); }}><LogOut className="h-4 w-4 mr-2" /> Sair</Button>
              </div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-medium">Admin Master</h1>
            <div className="flex items-center gap-1.5 min-w-0 text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <p className="text-xs truncate" title={email}>{email}</p>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
