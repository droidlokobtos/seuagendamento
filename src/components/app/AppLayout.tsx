import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company";
import {
  LayoutDashboard, Calendar, Users, UserCog, Scissors, Settings, LogOut, Menu, Sparkles,
  Wallet, Package, BarChart3, Ticket, Award, Star, Megaphone, Cake, Gift, Link2,
  MessageCircle, Image as ImageIcon, BadgePercent, CalendarCheck, Layers, Calculator,
  ShoppingCart, Palette, ChevronDown, Plus, MoreHorizontal, ShieldAlert, BookOpen, CircleDollarSign, History, ReceiptText, type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { getImpersonation, stopImpersonation } from "@/lib/impersonation";
import { usePermissions } from "@/lib/use-permissions";
import type { PermissionKey } from "@/lib/permissions";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; perm?: PermissionKey };
type NavGroup = { id: string; label: string; icon: LucideIcon; items: NavItem[] };

const GROUPS: NavGroup[] = [
  { id: "inicio", label: "Início", icon: LayoutDashboard, items: [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true, perm: "dashboard" },
    { to: "/app/reports", label: "Relatórios", icon: BarChart3, perm: "relatorios" },
  ]},
  { id: "operacao", label: "Operação", icon: Calendar, items: [
    { to: "/app/agenda", label: "Agenda", icon: Calendar, perm: "agenda" },
    { to: "/app/operations", label: "Central de Atendimento", icon: CalendarCheck, perm: "agendamentos" },
    { to: "/app/link", label: "Link exclusivo", icon: Link2, perm: "configuracoes" },
    { to: "/app/portal", label: "Personalizar página", icon: Palette, perm: "configuracoes" },
    { to: "/app/confirmations", label: "Confirmações automáticas", icon: CalendarCheck, perm: "agendamentos" },
    { to: "/app/attendance", label: "Comparecimento", icon: ShieldAlert, perm: "agendamentos" },
    { to: "/app/blocks", label: "Bloqueios de horários", icon: Calendar, perm: "agenda" },
  ]},
  { id: "clientes", label: "Clientes", icon: Users, items: [
    { to: "/app/customers", label: "Clientes e fichas", icon: Users, perm: "clientes" },
    { to: "/app/loyalty", label: "Fidelidade", icon: Award, perm: "clientes" },
    { to: "/app/rewards", label: "Recompensas", icon: Gift, perm: "clientes" },
    { to: "/app/reviews", label: "Avaliações", icon: Star, perm: "clientes" },
    { to: "/app/birthdays", label: "Aniversariantes", icon: Cake, perm: "clientes" },
    { to: "/app/campaigns", label: "Campanhas", icon: Megaphone, perm: "clientes" },
  ]},
  { id: "servicos", label: "Serviços", icon: Scissors, items: [
    { to: "/app/services", label: "Serviços e categorias", icon: Scissors, perm: "servicos" },
    { to: "/app/gallery", label: "Galeria de serviços", icon: ImageIcon, perm: "servicos" },
    { to: "/app/plans", label: "Planos e Pacotes", icon: Layers, perm: "servicos" },
    { to: "/app/procedures", label: "Calculadora de Procedimentos", icon: Calculator, perm: "servicos" },
  ]},
  { id: "financeiro", label: "Financeiro", icon: Wallet, items: [
    { to: "/app/finances", label: "Dashboard financeiro", icon: Wallet, perm: "financeiro" },
    { to: "/app/cash", label: "Fechamento de caixa", icon: CircleDollarSign, perm: "caixa" },
    { to: "/app/expenses", label: "Despesas e contas a pagar", icon: ReceiptText, perm: "financeiro" },
    { to: "/app/audit", label: "Auditoria", icon: History, perm: "financeiro" },
    { to: "/app/payments", label: "Pagamentos", icon: Wallet, perm: "financeiro" },
    { to: "/app/commissions", label: "Comissões", icon: BadgePercent, perm: "comissoes" },
    { to: "/app/sales", label: "Vendas", icon: ShoppingCart, perm: "caixa" },
    { to: "/app/coupons", label: "Cupons de desconto", icon: Ticket, perm: "financeiro" },
  ]},
  { id: "estoque", label: "Estoque", icon: Package, items: [{ to: "/app/products", label: "Produtos e movimentações", icon: Package, perm: "estoque" }]},
  { id: "equipe", label: "Equipe", icon: UserCog, items: [
    { to: "/app/staff", label: "Funcionários", icon: UserCog, perm: "configuracoes" },
    { to: "/app/commissions", label: "Comissões individuais", icon: BadgePercent, perm: "comissoes" },
  ]},
  { id: "inteligencia", label: "Inteligência", icon: Sparkles, items: [
    { to: "/app/ai", label: "Assistente IA", icon: Sparkles, perm: "relatorios" },
    { to: "/app/reports", label: "Relatórios inteligentes", icon: BarChart3, perm: "relatorios" },
  ]},
  { id: "admin", label: "Administração", icon: Settings, items: [
    { to: "/app/users", label: "Usuários", icon: UserCog, perm: "usuarios" },
    { to: "/app/whatsapp", label: "WhatsApp", icon: MessageCircle, perm: "configuracoes" },
    { to: "/app/settings", label: "Configurações", icon: Settings, perm: "configuracoes" },
  ]},
  { id: "ajuda", label: "Ajuda", icon: BookOpen, items: [
    { to: "/app/help", label: "Central de Ajuda", icon: BookOpen },
  ]},
];

const QUICK_ACTIONS: { to: string; label: string; icon: LucideIcon; perm: PermissionKey }[] = [
  { to: "/app/agenda", label: "Novo agendamento", icon: Calendar, perm: "agendamentos" },
  { to: "/app/customers", label: "Novo cliente", icon: Users, perm: "clientes_cadastro" },
  { to: "/app/sales", label: "Registrar venda", icon: ShoppingCart, perm: "caixa" },
  { to: "/app/payments", label: "Registrar pagamento", icon: Wallet, perm: "financeiro" },
];
const BOTTOM_NAV: NavItem[] = [
  { to: "/app", label: "Início", icon: LayoutDashboard, end: true, perm: "dashboard" },
  { to: "/app/agenda", label: "Agenda", icon: Calendar, perm: "agenda" },
  { to: "/app/customers", label: "Clientes", icon: Users, perm: "clientes" },
  { to: "/app/finances", label: "Financeiro", icon: Wallet, perm: "financeiro" },
];

export function AppLayout({ children }: { children?: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut, isSuperAdmin } = useAuth();
  const { companies, activeCompany, setActiveCompanyId } = useCompany();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { can } = usePermissions();
  const impersonating = isSuperAdmin && !!getImpersonation();
  const isActive = (to: string, end?: boolean) => end ? path === to : path === to || path.startsWith(to + "/");
  const groups = useMemo(() => GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || can(i.perm)) })).filter((g) => g.items.length > 0), [can]);
  const quickActions = useMemo(() => QUICK_ACTIONS.filter((a) => can(a.perm)), [can]);
  const bottomNav = useMemo(() => BOTTOM_NAV.filter((i) => !i.perm || can(i.perm)), [can]);
  const activeGroup = useMemo(() => GROUPS.find((g) => g.items.some((i) => isActive(i.to, i.end)))?.id ?? "inicio", [path]);
  const [openGroups, setOpenGroups] = useState<string[]>([activeGroup]);
  useEffect(() => setOpenGroups((prev) => prev.includes(activeGroup) ? prev : [...prev, activeGroup]), [activeGroup]);
  const toggleGroup = (id: string) => setOpenGroups((prev) => prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]);

  const Brand = () => (
    <div className="flex items-center gap-3 min-w-0">
      {activeCompany?.logo_url ? <img src={activeCompany.logo_url} className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-border shadow-sm" alt="" /> :
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><LayoutDashboard className="h-4 w-4" /></div>}
      <div className="min-w-0"><p className="text-sm font-semibold tracking-tight truncate">{activeCompany?.name ?? "Minha empresa"}</p><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Gestão empresarial</p></div>
    </div>
  );

  const NavList = () => (
    <nav className="flex flex-col gap-1.5 p-3">
      {groups.map((group) => { const expanded = openGroups.includes(group.id); const groupActive = group.items.some((i) => isActive(i.to, i.end)); return (
        <div key={group.id} className="rounded-xl">
          <button type="button" onClick={() => toggleGroup(group.id)} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-all ${groupActive ? "text-foreground bg-muted/60" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}>
            <group.icon className="h-3.5 w-3.5 shrink-0" /><span className="flex-1 text-left truncate">{group.label}</span><ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? "" : "-rotate-90"}`} />
          </button>
          {expanded && <div className="mt-1 mb-2 ml-4 flex flex-col gap-0.5 border-l border-border/70 pl-3">{group.items.map((item) => { const active = isActive(item.to, item.end); return (
            <Link key={group.id + item.to} to={item.to} onClick={() => setOpen(false)} className={`group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}>
              <item.icon className={`h-4 w-4 shrink-0 ${active ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`} /><span className="truncate">{item.label}</span>
            </Link>); })}</div>}
        </div>); })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,var(--color-background)_0%,var(--color-muted)_160%)] flex flex-col">
      {impersonating && <div className="bg-amber-500 text-black px-4 py-2 text-sm flex items-center gap-3 flex-wrap sticky top-0 z-40"><ShieldAlert className="h-4 w-4 shrink-0" /><span className="font-medium">Você está operando como Admin Master no ambiente de <strong>{activeCompany?.name}</strong>.</span><Button size="sm" variant="outline" className="ml-auto bg-white/90 hover:bg-white border-black/20" onClick={async () => { await stopImpersonation(); void navigate({ to: "/admin" }); }}>Voltar para Admin Master</Button></div>}
      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex md:w-72 shrink-0 border-r border-border/70 bg-card/90 backdrop-blur-xl flex-col shadow-[8px_0_30px_-24px_rgba(0,0,0,0.25)]">
          <div className="h-[72px] flex items-center px-5 border-b border-border/70"><Brand /></div><div className="flex-1 overflow-y-auto"><NavList /></div>
          <div className="border-t border-border/70 p-4 bg-muted/20"><div className="mb-3 px-1"><p className="text-xs font-semibold truncate">{user?.user_metadata?.full_name ?? user?.email}</p><p className="mt-0.5 text-[10px] text-muted-foreground truncate">{user?.email}</p></div><Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={async () => { await signOut(); void navigate({ to: "/auth", replace: true }); }}><LogOut className="h-4 w-4 mr-2" /> Sair</Button></div>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-[72px] border-b border-border/70 bg-card/80 backdrop-blur-xl flex items-center gap-3 px-4 md:px-7 sticky top-0 z-30 shadow-[0_8px_30px_-26px_rgba(0,0,0,0.35)]">
            <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="md:hidden rounded-xl"><Menu className="h-5 w-5" /></Button></SheetTrigger><SheetContent side="left" className="p-0 w-72 flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden bg-card"><div className="h-[72px] shrink-0 flex items-center px-5 border-b"><Brand /></div><div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}><NavList /></div><div className="shrink-0 border-t border-border/60 p-4"><p className="mb-2 px-1 text-[10px] text-muted-foreground truncate">{user?.email}</p><Button variant="ghost" size="sm" className="w-full justify-start" onClick={async () => { setOpen(false); await signOut(); void navigate({ to: "/auth", replace: true }); }}><LogOut className="h-4 w-4 mr-2" /> Sair</Button></div></SheetContent></Sheet>
            {companies.length > 1 ? <Select value={activeCompany?.id} onValueChange={setActiveCompanyId}><SelectTrigger className="w-[180px] md:w-[230px] h-10 rounded-xl bg-background/70 border-border/80"><SelectValue /></SelectTrigger><SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select> : <div className="hidden sm:block"><p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Ambiente de gestão</p><p className="text-sm font-semibold tracking-tight truncate">{activeCompany?.name}</p></div>}
            <div className="ml-auto flex items-center gap-2"><div className="hidden lg:flex items-center gap-2">{quickActions.map((a) => <Button key={a.label} asChild variant="outline" size="sm" className="rounded-xl bg-background/60 shadow-sm"><Link to={a.to}><a.icon className="h-3.5 w-3.5 mr-1.5" />{a.label}</Link></Button>)}</div><DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" className="lg:hidden rounded-xl"><Plus className="h-4 w-4 mr-1" /> Novo</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{quickActions.map((a) => <DropdownMenuItem key={a.label} asChild><Link to={a.to}><a.icon className="h-4 w-4 mr-2" />{a.label}</Link></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu><NotificationsBell /></div>
          </header>
          <main className="flex-1 p-4 md:p-7 lg:p-9 pb-24 md:pb-9">{children ?? <Outlet />}</main>
        </div>
      </div>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/70 bg-card/95 backdrop-blur-xl shadow-[0_-10px_30px_-25px_rgba(0,0,0,0.3)]"><div className="flex justify-around">{bottomNav.map((item) => { const active = isActive(item.to, item.end); return <Link key={item.to} to={item.to} className={`flex min-w-16 flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}><item.icon className="h-5 w-5" />{item.label}</Link>; })}<button type="button" onClick={() => setOpen(true)} className="flex min-w-16 flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground"><MoreHorizontal className="h-5 w-5" />Mais</button></div></nav>
    </div>
  );
}
