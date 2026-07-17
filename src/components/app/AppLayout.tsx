import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company";
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCog,
  Scissors,
  Settings,
  LogOut,
  Menu,
  Sparkles,
  Wallet,
  Package,
  BarChart3,
  Ticket,
  Award,
  Star,
  Megaphone,
  Cake,
  Gift,
  Link2,
  MessageCircle,

} from "lucide-react";




import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { getImpersonation, stopImpersonation } from "@/lib/impersonation";
import { ShieldAlert } from "lucide-react";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/link", label: "Link exclusivo", icon: Link2 },
  { to: "/app/blocks", label: "Bloqueios", icon: Calendar },
  { to: "/app/customers", label: "Clientes", icon: Users },
  { to: "/app/staff", label: "Funcionários", icon: UserCog },
  { to: "/app/services", label: "Serviços", icon: Scissors },
  { to: "/app/finances", label: "Financeiro", icon: Wallet },
  { to: "/app/products", label: "Estoque", icon: Package },
  { to: "/app/reports", label: "Relatórios", icon: BarChart3 },
  { to: "/app/coupons", label: "Cupons", icon: Ticket },
  { to: "/app/loyalty", label: "Fidelidade", icon: Award },
  { to: "/app/rewards", label: "Recompensas", icon: Gift },
  { to: "/app/campaigns", label: "Campanhas", icon: Megaphone },
  { to: "/app/birthdays", label: "Aniversariantes", icon: Cake },
  { to: "/app/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/app/reviews", label: "Avaliações", icon: Star },
  { to: "/app/ai", label: "Assistente IA", icon: Sparkles },
  { to: "/app/users", label: "Usuários", icon: UserCog },
  { to: "/app/settings", label: "Configurações", icon: Settings },
];


export function AppLayout({ children }: { children?: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut, isSuperAdmin } = useAuth();
  const { companies, activeCompany, setActiveCompanyId } = useCompany();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const impersonating = isSuperAdmin && !!getImpersonation();

  const isActive = (to: string, end?: boolean) =>
    end ? path === to : path === to || path.startsWith(to + "/");

  const Brand = () => (
    <div className="flex items-center gap-2 min-w-0">
      {activeCompany?.logo_url ? (
        <img src={activeCompany.logo_url} className="h-8 w-8 rounded-lg object-cover" alt="" />
      ) : (
        <div
          className="grid h-8 w-8 place-items-center rounded-lg text-primary-foreground"
          style={{ background: activeCompany?.primary_color || "hsl(var(--primary))" }}
        >
          <Sparkles className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight truncate">
          {activeCompany?.name ?? "Minha empresa"}
        </p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Painel</p>
      </div>
    </div>
  );

  const NavList = () => (
    <nav className="flex flex-col gap-0.5 p-2">
      {NAV.map((item) => {
        const active = isActive(item.to, item.end);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {impersonating && (
        <div className="bg-amber-500 text-black px-4 py-2 text-sm flex items-center gap-3 flex-wrap sticky top-0 z-40">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            Você está operando como Admin Master no ambiente de{" "}
            <strong>{activeCompany?.name}</strong>.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto bg-white/90 hover:bg-white border-black/20"
            onClick={async () => {
              await stopImpersonation();
              void navigate({ to: "/admin" });
            }}
          >
            Voltar para Admin Master
          </Button>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
      <aside className="hidden md:flex md:w-64 shrink-0 border-r border-border/60 bg-card/50 flex-col">
        <div className="h-16 flex items-center gap-2 px-4 border-b border-border/60">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList />
        </div>
        <div className="border-t border-border/60 p-3">
          <div className="mb-2 px-1">
            <p className="text-xs font-medium truncate">
              {user?.user_metadata?.full_name ?? user?.email}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border/60 bg-card/40 backdrop-blur flex items-center gap-3 px-4 md:px-6 sticky top-0 z-30">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <div className="h-16 flex items-center gap-2 px-4 border-b">
                <Brand />
              </div>
              <NavList />
            </SheetContent>
          </Sheet>

          {companies.length > 1 ? (
            <Select value={activeCompany?.id} onValueChange={setActiveCompanyId}>
              <SelectTrigger className="w-[220px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm font-medium text-muted-foreground truncate">
              {activeCompany?.name}
            </div>
          )}
          <div className="ml-auto flex items-center gap-1">
            <NotificationsBell />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children ?? <Outlet />}</main>
      </div>
      </div>
    </div>
  );
}
