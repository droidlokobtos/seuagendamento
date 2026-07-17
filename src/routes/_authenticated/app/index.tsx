import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Users, TrendingUp, Clock } from "lucide-react";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
  const in7 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString();
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString();

  const { data: stats } = useQuery({
    queryKey: ["app-dashboard", companyId],
    queryFn: async () => {
      const [todayR, weekR, custR, monthR] = await Promise.all([
        supabase.from("appointments").select("id,starts_at,status,total_cents,customers(name),staff(name)")
          .eq("company_id", companyId).gte("starts_at", startOfDay).lt("starts_at", endOfDay).order("starts_at"),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .eq("company_id", companyId).gte("starts_at", startOfDay).lt("starts_at", in7),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("appointments").select("total_cents")
          .eq("company_id", companyId).eq("status", "completed")
          .gte("starts_at", startMonth).lt("starts_at", endMonth),
      ]);
      const revenue = (monthR.data ?? []).reduce((s, a: any) => s + (a.total_cents ?? 0), 0) / 100;
      return {
        today: todayR.data ?? [],
        weekCount: weekR.count ?? 0,
        customersCount: custR.count ?? 0,
        revenue,
      };
    },
  });

  const cards = [
    { label: "Agendamentos hoje", value: stats?.today.length ?? 0, icon: Calendar },
    { label: "Próximos 7 dias", value: stats?.weekCount ?? 0, icon: Clock },
    { label: "Clientes", value: stats?.customersCount ?? 0, icon: Users },
    { label: "Faturamento do mês", value: brl(stats?.revenue ?? 0), icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Olá 👋</h1>
        <p className="text-sm text-muted-foreground">Visão geral da sua operação hoje.</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{c.value}</p>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <c.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
};
