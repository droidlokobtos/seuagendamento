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
  Image as ImageIcon,
  BadgePercent,
  CalendarCheck,
  Layers,
  Calculator,
  ShoppingCart,
  Palette,
  ChevronDown,
  Plus,
  MoreHorizontal,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { getImpersonation, stopImpersonation } from "@/lib/impersonation";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };
type NavGroup = { id: string; label: string; emoji: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    id: "inicio",
    label: "Início",
    emoji: "📊",
    items: [
      { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/app/reports", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    id: "operacao",
    label: "Operação",
    emoji: "📅",
    items: [
      { to: "/app/agenda", label: "Agenda", icon: Calendar },
      { to: "/app/link", label: "Link exclusivo", icon: Link2 },
      { to: "/app/portal", label: "Personalizar página", icon: Palette },
      { to: "/app/confirmations", label: "Confirmações automáticas", icon: CalendarCheck },
      { to: "/app/attendance", label: "Comparecimento", icon: ShieldAlert },
      { to: "/app/blocks", label: "Bloqueios de horários", icon: Calendar },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    emoji: "👥",
    items: [
      { to: "/app/customers", label: "Clientes e fichas", icon: Users },
      { to: "/app/loyalty", label: "Fidelidade", icon: Award },
      { to: "/app/rewards", label: "Recompensas", icon: Gift },
      { to: "/app/reviews", label: "Avaliações", icon: Star },
      { to: "/app/birthdays", label: "Aniversariantes", icon: Cake },
      { to: "/app/campaigns", label: "Campanhas", icon: Megaphone },
    ],
  },
  {
    id: "servicos",
    label: "Serviços",
    emoji: "✂️",
    items: [
      { to: "/app/services", label: "Serviços e categorias", icon: Scissors },
      { to: "/app/gallery", label: "Galeria de serviços", icon: ImageIcon },
      { to: "/app/plans", label: "Planos e Pacotes", icon: Layers },
      { to: "/app/procedures", label: "Calculadora de Procedimentos", icon: Calculator },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    emoji: "💰",
    items: [
      { to: "/app/finances", label: "Dashboard financeiro", icon: Wallet },
      { to: "/app/payments", label: "Pagamentos", icon: Wallet },
      { to: "/app/commissions", label: "Comissões", icon: BadgePercent },
      { to: "/app/sales", label: "Vendas", icon: ShoppingCart },
      { to: "/app/coupons", label: "Cupons de desconto", icon: Ticket },
    ],
  },
  {
    id: "estoque",
    label: "Estoque",
    emoji: "📦",
    items: [{ to: "/app/products", label: "Produtos e movimentações", icon: Package }],
  },
  {
    id: "equipe",
    label: "Equipe",
    emoji: "👨‍💼",
    items: [
      { to: "/app/staff", label: "Funcionários", icon: UserCog },
      { to: "/app/commissions", label: "Comissões individuais", icon: BadgePercent },
    ],
  },
  {
    id: "inteligencia",
    label: "Inteligência",
    emoji: "🤖",
    items: [
      { to: "/app/ai", label: "Assistente IA", icon: Sparkles },
      { to: "/app/reports", label: "Relatórios inteligentes", icon: BarChart3 },
    ],
  },
  {
    id: "admin",
    label: "Administração",
    emoji: "⚙️",
    items: [
      { to: "/app/users", label: "Usuários", icon: UserCog },
      { to: "/app/whatsapp", label: "WhatsApp", icon: MessageCircle },
      { to: "/app/settings", label: "Configurações", icon: Settings },
    ],
  },
];

const QUICK_ACTIONS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/app/agenda", label: "Novo agendamento", icon: Calendar },
  { to: "/app/customers", label: "Novo cliente", icon: Users },
  { to: "/app/sales", label: "Registrar venda", icon: ShoppingCart },
  { to: "/app/payments", label: "Registrar pagamento", icon: Wallet },
];

const BOTTOM_NAV: NavItem[] = [
  { to: "/app", label: "Início", icon: LayoutDashboard, end: true },
  { to: "/app/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/customers", label: "Clientes", icon: Users },
  { to: "/app/finances", label: "Financeiro", icon: Wallet },
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

  const activeGroup = useMemo(
    () => GROUPS.find((g) => g.items.some((i) => isActive(i.to, i.end)))?.id ?? "inicio",
    [path],
  );
  const [openGroups, setOpenGroups] = useState<string[]>([activeGroup]);
  useEffect(() => {
    setOpenGroups((prev) => (prev.includes(activeGroup) ? prev : [...prev, activeGroup]));
  }, [activeGroup]);

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  const Brand = () => (
    <div className="flex items-center gap-2 min-w-0">
      {activeCompany?.logo_url ? (
        <img src={activeCompany.logo_url} className="h-9 w-9 shrink-0 rounded-xl object-cover" alt="" />
      ) : (
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-primary-foreground"
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
    <nav className="flex flex-col gap-1 p-2">
      {GROUPS.map((group) => {
        const expanded = openGroups.includes(group.id);
        const groupActive = group.items.some((i) => isActive(i.to, i.end));
        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                groupActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span aria-hidden className="text-sm leading-none">
                {group.emoji}
              </span>
              <span className="flex-1 text-left truncate">{group.label}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? "" : "-rotate-90"}`}
              />
            </button>
            {expanded && (
              <div className="mb-1 ml-4 flex flex-col gap-0.5 border-l border-border/60 pl-2">
                {group.items.map((item) => {
                  const active = isActive(item.to, item.end);
                  return (
                    <Link
                      key={group.id + item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
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
        <aside className="hidden md:flex md:w-72 shrink-0 border-r border-border/60 bg-card/50 flex-col">
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
              <SheetContent
                side="left"
                className="p-0 w-72 flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden"
              >
                <div className="h-16 shrink-0 flex items-center gap-2 px-4 border-b">
                  <Brand />
                </div>
                <div
                  className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  <NavList />
                </div>
                <div className="shrink-0 border-t border-border/60 p-3">
                  <p className="mb-2 px-1 text-[10px] text-muted-foreground truncate">{user?.email}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={async () => {
                      setOpen(false);
                      await signOut();
                      void navigate({ to: "/auth", replace: true });
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Sair
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {companies.length > 1 ? (
              <Select value={activeCompany?.id} onValueChange={setActiveCompanyId}>
                <SelectTrigger className="w-[180px] md:w-[220px] h-9">
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
              <div className="hidden sm:block text-sm font-medium text-muted-foreground truncate">
                {activeCompany?.name}
              </div>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              <div className="hidden lg:flex items-center gap-1.5">
                {QUICK_ACTIONS.map((a) => (
                  <Button key={a.label} asChild variant="outline" size="sm">
                    <Link to={a.to}>
                      <a.icon className="h-3.5 w-3.5 mr-1.5" />
                      {a.label}
                    </Link>
                  </Button>
                ))}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="lg:hidden">
                    <Plus className="h-4 w-4 mr-1" /> Novo
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {QUICK_ACTIONS.map((a) => (
                    <DropdownMenuItem key={a.label} asChild>
                      <Link to={a.to}>
                        <a.icon className="h-4 w-4 mr-2" />
                        {a.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <NotificationsBell />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-8">{children ?? <Outlet />}</main>
        </div>
      </div>

      {/* Navegação inferior (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur">
        <div className="grid grid-cols-5">
          {BOTTOM_NAV.map((item) => {
            const active = isActive(item.to, item.end);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
            Mais
          </button>
        </div>
      </nav>
    </div>
  );
}
