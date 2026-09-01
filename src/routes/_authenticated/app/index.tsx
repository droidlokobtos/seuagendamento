import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, TrendingUp, Clock, Link2, Copy, DollarSign, XCircle, UserPlus, Repeat, Scissors, Trophy, ArrowUpRight } from "lucide-react";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import { usePermissions } from "@/lib/use-permissions";
import { ProfessionalDashboard } from "@/components/app/ProfessionalDashboard";
import { ReceptionDashboard } from "@/components/app/ReceptionDashboard";

export const Route = createFileRoute("/_authenticated/app/")({ component: RoleDashboard });

function RoleDashboard() {
  const { isProfessional, isReceptionist } = usePermissions();
  if (isProfessional) return <ProfessionalDashboard />;
  if (isReceptionist) return <ReceptionDashboard />;
  return <Dashboard />;
}

function Dashboard() {
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
  const in7 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString();
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString();
  const monthStartDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  const { data: stats } = useQuery({
    queryKey: ["app-dashboard", companyId],
    queryFn: async () => {
      const [todayR, weekR, custR, monthR, newCustR, monthApptsR] = await Promise.all([
        supabase.from("appointments").select("id,starts_at,status,total_cents,customer_id,customers(name),staff(name)").eq("company_id", companyId).gte("starts_at", startOfDay).lt("starts_at", endOfDay).order("starts_at"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("company_id", companyId).gte("starts_at", startOfDay).lt("starts_at", in7),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("appointments").select("total_cents,discount_cents").eq("company_id", companyId).eq("status", "completed").gte("starts_at", startMonth).lt("starts_at", endMonth),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", companyId).gte("created_at", startMonth),
        supabase.from("appointments").select("id,status,total_cents,discount_cents,customer_id,staff_id,staff(name),appointment_services(service_id,services(name))").eq("company_id", companyId).gte("starts_at", startMonth).lt("starts_at", endMonth),
      ]);
      const monthRevenue = (monthR.data ?? []).reduce((s, a: any) => s + Math.max(0, (a.total_cents ?? 0) - (a.discount_cents ?? 0)), 0) / 100;
      const todayList = todayR.data ?? [];
      const todayRevenue = todayList.filter((a: any) => a.status === "completed").reduce((s, a: any) => s + (a.total_cents ?? 0), 0) / 100;
      return { today: todayList, weekCount: weekR.count ?? 0, customersCount: custR.count ?? 0, monthRevenue, todayRevenue, todayCancelled: todayList.filter((a: any) => a.status === "cancelled" || a.status === "no_show").length, newCustomersMonth: newCustR.count ?? 0, monthAppts: monthApptsR.data ?? [] };
    },
  });

  const { data: recurring } = useQuery({
    queryKey: ["dashboard-recurring", companyId, monthStartDate],
    queryFn: async () => {
      const monthCustIds = new Set((stats?.monthAppts ?? []).map((a: any) => a.customer_id).filter(Boolean));
      if (!monthCustIds.size) return 0;
      const { data } = await supabase.from("appointments").select("customer_id").eq("company_id", companyId).lt("starts_at", startMonth).in("customer_id", Array.from(monthCustIds) as string[]);
      const prior = new Set((data ?? []).map((a: any) => a.customer_id));
      let count = 0;
      for (const id of monthCustIds) if (prior.has(id)) count++;
      return count;
    }, enabled: !!stats,
  });

  const { topServices, topStaff } = useMemo(() => {
    const svcMap = new Map<string, { name: string; count: number }>();
    const staffMap = new Map<string, { name: string; revenue: number }>();
    for (const a of (stats?.monthAppts ?? []) as any[]) {
      if (a.status === "completed" && a.staff_id) {
        const cur = staffMap.get(a.staff_id) ?? { name: a.staff?.name ?? "—", revenue: 0 };
        cur.revenue += Math.max(0, (a.total_cents ?? 0) - (a.discount_cents ?? 0));
        staffMap.set(a.staff_id, cur);
      }
      for (const s of (a.appointment_services ?? []) as any[]) {
        if (!s.service_id) continue;
        const cur = svcMap.get(s.service_id) ?? { name: s.services?.name ?? "—", count: 0 };
        cur.count += 1; svcMap.set(s.service_id, cur);
      }
    }
    return { topServices: Array.from(svcMap.values()).sort((a, b) => b.count - a.count).slice(0, 5), topStaff: Array.from(staffMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5) };
  }, [stats?.monthAppts]);

  const cards = [
    { label: "Agendamentos hoje", value: stats?.today.length ?? 0, icon: Calendar },
    { label: "Próximos 7 dias", value: stats?.weekCount ?? 0, icon: Clock },
    { label: "Receita hoje", value: brl(stats?.todayRevenue ?? 0), icon: DollarSign },
    { label: "Cancelamentos", value: stats?.todayCancelled ?? 0, icon: XCircle },
    { label: "Faturamento mensal", value: brl(stats?.monthRevenue ?? 0), icon: TrendingUp },
    { label: "Base de clientes", value: stats?.customersCount ?? 0, icon: Users },
    { label: "Novos clientes", value: stats?.newCustomersMonth ?? 0, icon: UserPlus },
    { label: "Clientes recorrentes", value: recurring ?? 0, icon: Repeat },
  ];

  const bookingUrl = typeof window !== "undefined" ? `${window.location.origin}/b/${activeCompany!.slug}` : `/b/${activeCompany!.slug}`;
  const dateLabel = today.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return <div className="space-y-7 pb-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Painel de gestão</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Visão geral</h1>
        <p className="mt-1 text-sm text-muted-foreground capitalize">{dateLabel} · {activeCompany?.name}</p>
      </div>
      <Button asChild className="w-full sm:w-auto"><Link to="/app/agenda"><Calendar className="mr-2 h-4 w-4" />Abrir agenda</Link></Button>
    </div>

    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border bg-muted/40"><Link2 className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted-foreground">Página pública de agendamento</p><p className="mt-1 truncate text-sm font-medium">{bookingUrl}</p></div>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(bookingUrl)}><Copy className="mr-2 h-4 w-4" />Copiar</Button><Button asChild size="sm" variant="secondary"><a href={bookingUrl} target="_blank" rel="noreferrer">Visualizar<ArrowUpRight className="ml-2 h-4 w-4" /></a></Button></div>
      </CardContent>
    </Card>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => <Card key={c.label} className="border-border/70 shadow-sm transition-shadow hover:shadow-md"><CardContent className="p-5"><div className="mb-5 flex items-center justify-between"><div className="grid h-9 w-9 place-items-center rounded-lg border bg-muted/30"><c.icon className="h-4 w-4 text-foreground/70" /></div><span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Indicador</span></div><p className="text-sm text-muted-foreground">{c.label}</p><p className="mt-1 text-2xl font-semibold tracking-tight">{c.value}</p></CardContent></Card>)}
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <RankingCard title="Serviços mais procurados" subtitle="Desempenho no mês atual" icon={Scissors} empty="Sem serviços registrados neste mês.">{topServices.map((s, i) => <div key={i} className="flex items-center gap-3 border-t px-5 py-3.5"><span className="w-6 text-xs font-semibold text-muted-foreground">{String(i + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span><span className="text-sm font-semibold tabular-nums">{s.count}</span></div>)}</RankingCard>
      <RankingCard title="Desempenho da equipe" subtitle="Faturamento por profissional" icon={Trophy} empty="Sem faturamento registrado neste mês.">{topStaff.map((s, i) => <div key={i} className="flex items-center gap-3 border-t px-5 py-3.5"><span className="w-6 text-xs font-semibold text-muted-foreground">{String(i + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span><span className="text-sm font-semibold tabular-nums">{brl(s.revenue / 100)}</span></div>)}</RankingCard>
    </div>

    <Card className="border-border/70 shadow-sm"><CardHeader className="flex flex-row items-center justify-between space-y-0 border-b p-5"><div><CardTitle className="text-base">Agenda de hoje</CardTitle><p className="mt-1 text-xs text-muted-foreground">Próximos compromissos e situação dos atendimentos</p></div><Button asChild size="sm" variant="ghost"><Link to="/app/agenda">Ver agenda<ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button></CardHeader><CardContent className="p-0">{!stats?.today.length ? <p className="py-12 text-center text-sm text-muted-foreground">Nenhum agendamento para hoje.</p> : <div>{stats.today.map((a: any) => <div key={a.id} className="flex items-center justify-between gap-4 border-b px-5 py-4 last:border-0"><div className="flex min-w-0 items-center gap-4"><div className="w-12 shrink-0 text-sm font-semibold tabular-nums">{new Date(a.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{a.customers?.name ?? "Sem cliente"}</p><p className="truncate text-xs text-muted-foreground">{a.staff?.name ?? "Sem profissional"} · {statusMap[a.status] ?? a.status}</p></div></div><span className="shrink-0 text-sm font-semibold tabular-nums">{brl((a.total_cents ?? 0) / 100)}</span></div>)}</div>}</CardContent></Card>
  </div>;
}

function RankingCard({ title, subtitle, icon: Icon, empty, children }: any) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return <Card className="overflow-hidden border-border/70 shadow-sm"><CardHeader className="p-5"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg border bg-muted/30"><Icon className="h-4 w-4 text-foreground/70" /></div><div><CardTitle className="text-base">{title}</CardTitle><p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p></div></div></CardHeader><CardContent className="p-0">{hasChildren ? children : <p className="border-t px-5 py-10 text-center text-sm text-muted-foreground">{empty}</p>}</CardContent></Card>;
}

const statusMap: Record<string, string> = { scheduled: "Agendado", confirmed: "Confirmado", in_progress: "Em atendimento", completed: "Concluído", cancelled: "Cancelado", no_show: "Faltou", reminder_sent: "Lembrete enviado", cancelled_by_customer: "Cancelado pelo cliente", cancelled_by_company: "Cancelado pela empresa" };
