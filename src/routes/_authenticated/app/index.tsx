import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar,
  Users,
  TrendingUp,
  Clock,
  Link2,
  Copy,
  DollarSign,
  XCircle,
  UserPlus,
  Repeat,
  Scissors,
  Trophy,
} from "lucide-react";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";

import { usePermissions } from "@/lib/use-permissions";
import { ProfessionalDashboard } from "@/components/app/ProfessionalDashboard";
import { ReceptionDashboard } from "@/components/app/ReceptionDashboard";

export const Route = createFileRoute("/_authenticated/app/")({
  component: RoleDashboard,
});

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
        supabase.from("appointments").select("id,starts_at,status,total_cents,customer_id,customers(name),staff(name)")
          .eq("company_id", companyId).gte("starts_at", startOfDay).lt("starts_at", endOfDay).order("starts_at"),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .eq("company_id", companyId).gte("starts_at", startOfDay).lt("starts_at", in7),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("appointments").select("total_cents,discount_cents")
          .eq("company_id", companyId).eq("status", "completed")
          .gte("starts_at", startMonth).lt("starts_at", endMonth),
        supabase.from("customers").select("id", { count: "exact", head: true })
          .eq("company_id", companyId).gte("created_at", startMonth),
        // Month appointments for top services / staff / recurring
        supabase.from("appointments").select(
          "id,status,total_cents,discount_cents,customer_id,staff_id,staff(name),appointment_services(service_id,services(name))"
        ).eq("company_id", companyId).gte("starts_at", startMonth).lt("starts_at", endMonth),
      ]);
      const monthRevenue = (monthR.data ?? []).reduce(
        (s, a: any) => s + Math.max(0, (a.total_cents ?? 0) - (a.discount_cents ?? 0)),
        0,
      ) / 100;
      const todayList = todayR.data ?? [];
      const todayRevenue = todayList
        .filter((a: any) => a.status === "completed")
        .reduce((s, a: any) => s + (a.total_cents ?? 0), 0) / 100;
      const todayCancelled = todayList.filter((a: any) => a.status === "cancelled" || a.status === "no_show").length;

      return {
        today: todayList,
        weekCount: weekR.count ?? 0,
        customersCount: custR.count ?? 0,
        monthRevenue,
        todayRevenue,
        todayCancelled,
        newCustomersMonth: newCustR.count ?? 0,
        monthAppts: monthApptsR.data ?? [],
      };
    },
  });

  const { data: recurring } = useQuery({
    queryKey: ["dashboard-recurring", companyId, monthStartDate],
    queryFn: async () => {
      // Recurring = customers that had appointments before this month AND at least one this month
      const monthCustIds = new Set(
        (stats?.monthAppts ?? [])
          .map((a: any) => a.customer_id)
          .filter(Boolean),
      );
      if (!monthCustIds.size) return 0;
      const { data } = await supabase
        .from("appointments")
        .select("customer_id")
        .eq("company_id", companyId)
        .lt("starts_at", startMonth)
        .in("customer_id", Array.from(monthCustIds) as string[]);
      const prior = new Set((data ?? []).map((a: any) => a.customer_id));
      let count = 0;
      for (const id of monthCustIds) if (prior.has(id)) count++;
      return count;
    },
    enabled: !!stats,
  });

  const { topServices, topStaff } = useMemo(() => {
    const svcMap = new Map<string, { name: string; count: number }>();
    const staffMap = new Map<string, { name: string; revenue: number }>();
    for (const a of (stats?.monthAppts ?? []) as any[]) {
      if (a.status === "completed") {
        const net = Math.max(0, (a.total_cents ?? 0) - (a.discount_cents ?? 0));
        if (a.staff_id) {
          const cur = staffMap.get(a.staff_id) ?? { name: a.staff?.name ?? "—", revenue: 0 };
          cur.revenue += net;
          staffMap.set(a.staff_id, cur);
        }
      }
      for (const s of (a.appointment_services ?? []) as any[]) {
        if (!s.service_id) continue;
        const cur = svcMap.get(s.service_id) ?? { name: s.services?.name ?? "—", count: 0 };
        cur.count += 1;
        svcMap.set(s.service_id, cur);
      }
    }
    return {
      topServices: Array.from(svcMap.values()).sort((a, b) => b.count - a.count).slice(0, 5),
      topStaff: Array.from(staffMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    };
  }, [stats?.monthAppts]);

  const cards = [
    { label: "Agendamentos hoje", value: stats?.today.length ?? 0, icon: Calendar },
    { label: "Próximos 7 dias", value: stats?.weekCount ?? 0, icon: Clock },
    { label: "Receita hoje", value: brl(stats?.todayRevenue ?? 0), icon: DollarSign },
    { label: "Cancelamentos hoje", value: stats?.todayCancelled ?? 0, icon: XCircle, tone: "text-rose-600" },
    { label: "Faturamento do mês", value: brl(stats?.monthRevenue ?? 0), icon: TrendingUp },
    { label: "Clientes cadastrados", value: stats?.customersCount ?? 0, icon: Users },
    { label: "Novos no mês", value: stats?.newCustomersMonth ?? 0, icon: UserPlus, tone: "text-emerald-600" },
    { label: "Recorrentes no mês", value: recurring ?? 0, icon: Repeat, tone: "text-primary" },
  ];

  const bookingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/b/${activeCompany!.slug}`
    : `/b/${activeCompany!.slug}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Olá 👋</h1>
        <p className="text-sm text-muted-foreground">Visão geral da sua operação hoje.</p>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-4 flex items-center gap-3 flex-wrap">
          <Link2 className="h-5 w-5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Link público de agendamento</p>
            <p className="text-sm font-medium truncate">{bookingUrl}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            navigator.clipboard.writeText(bookingUrl);
          }}>
            <Copy className="h-4 w-4 mr-1" /> Copiar
          </Button>
          <a href={bookingUrl} target="_blank" rel="noreferrer">
            <Button size="sm">Abrir</Button>
          </a>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className={`mt-1 text-2xl font-semibold ${c.tone ?? ""}`}>{c.value}</p>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <c.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Scissors className="h-4 w-4 text-primary" /> Top serviços do mês
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!topServices.length ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Sem dados no mês.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {topServices.map((s, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm truncate">
                      <span className="text-muted-foreground mr-2">{i + 1}.</span>
                      {s.name}
                    </span>
                    <span className="text-sm font-semibold">{s.count}x</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> Top profissionais do mês
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!topStaff.length ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Sem dados no mês.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {topStaff.map((s, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm truncate">
                      <span className="text-muted-foreground mr-2">{i + 1}.</span>
                      {s.name}
                    </span>
                    <span className="text-sm font-semibold">{brl(s.revenue / 100)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Agenda de hoje</h2>
            <Button asChild size="sm" variant="outline"><Link to="/app/agenda">Abrir agenda</Link></Button>
          </div>
          {!stats?.today.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum agendamento para hoje.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {stats.today.map((a: any) => (
                <div key={a.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(a.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} —{" "}
                      {a.customers?.name ?? "Sem cliente"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.staff?.name ?? "Sem profissional"} · {statusMap[a.status] ?? a.status}
                    </p>
                  </div>
                  <span className="text-sm font-medium">{brl((a.total_cents ?? 0) / 100)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const statusMap: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Faltou",
  reminder_sent: "Lembrete enviado",
  cancelled_by_customer: "Cancelado pelo cliente",
  cancelled_by_company: "Cancelado pela empresa",
};
