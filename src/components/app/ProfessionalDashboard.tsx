import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { usePermissions } from "@/lib/use-permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { Calendar, Clock, BadgePercent, TrendingUp, Star, Users } from "lucide-react";

function dayRange(offsetDays = 0) {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays + 1);
  return [start.toISOString(), end.toISOString()] as const;
}

export function ProfessionalDashboard() {
  const { activeCompany } = useCompany();
  const { membership, can } = usePermissions();
  const companyId = activeCompany?.id;
  const staffId = membership?.staffId ?? null;

  const now = new Date();
  const [todayStart, todayEnd] = dayRange();
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["pro-dashboard", companyId, staffId],
    enabled: !!companyId && !!staffId,
    queryFn: async () => {
      const [todayR, weekR, monthR, comR, blocksR] = await Promise.all([
        supabase
          .from("appointments")
          .select("id,starts_at,ends_at,status,notes,total_cents,customers(name),appointment_services(services(name))")
          .eq("company_id", companyId!)
          .eq("staff_id", staffId!)
          .gte("starts_at", todayStart)
          .lt("starts_at", todayEnd)
          .order("starts_at"),
        supabase
          .from("appointments")
          .select("id,starts_at,status,customers(name)")
          .eq("company_id", companyId!)
          .eq("staff_id", staffId!)
          .gte("starts_at", todayEnd)
          .lt("starts_at", weekEnd)
          .order("starts_at"),
        supabase
          .from("appointments")
          .select("id,status,total_cents,discount_cents")
          .eq("company_id", companyId!)
          .eq("staff_id", staffId!)
          .gte("starts_at", monthStart)
          .lt("starts_at", monthEnd),
        supabase
          .from("commissions")
          .select("id,amount_cents,rate,status,created_at,appointment_id")
          .eq("company_id", companyId!)
          .eq("staff_id", staffId!)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("time_blocks")
          .select("id,starts_at,ends_at,reason")
          .eq("company_id", companyId!)
          .gte("starts_at", todayStart)
          .lt("starts_at", weekEnd)
          .order("starts_at"),
      ]);
      return {
        today: todayR.data ?? [],
        week: weekR.data ?? [],
        month: monthR.data ?? [],
        commissions: comR.data ?? [],
        blocks: blocksR.data ?? [],
      };
    },
  });

  const kpi = useMemo(() => {
    const month = (data?.month ?? []) as any[];
    const done = month.filter((a) => a.status === "completed");
    const revenue = done.reduce(
      (s, a) => s + Math.max(0, (a.total_cents ?? 0) - (a.discount_cents ?? 0)),
      0,
    );
    const commissions = (data?.commissions ?? []) as any[];
    const pending = commissions
      .filter((c) => c.status !== "paid")
      .reduce((s, c) => s + (c.amount_cents ?? 0), 0);
    const paid = commissions
      .filter((c) => c.status === "paid")
      .reduce((s, c) => s + (c.amount_cents ?? 0), 0);
    return {
      count: done.length,
      revenue,
      ticket: done.length ? Math.round(revenue / done.length) : 0,
      pending,
      paid,
    };
  }, [data]);

  if (!staffId) {
    return (
      <Card className="max-w-lg">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Seu usuário ainda não está vinculado a um profissional. Peça ao administrador para fazer
          o vínculo em Usuários.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meu painel</h1>
        <p className="text-sm text-muted-foreground">Sua agenda, atendimentos e comissões.</p>
      </div>

      {can("desempenho") && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Calendar} label="Atendimentos no mês" value={String(kpi.count)} />
          <Kpi icon={TrendingUp} label="Faturamento gerado" value={brl(kpi.revenue / 100)} />
          <Kpi icon={Star} label="Ticket médio" value={brl(kpi.ticket / 100)} />
          {can("comissoes") && <Kpi icon={BadgePercent} label="Comissão a receber" value={brl(kpi.pending / 100)} />}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {can("comissoes") && <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Agenda de hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
            ) : (data?.today ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Nenhum atendimento hoje.</p>
            ) : (
              <div className="divide-y">
                {(data!.today as any[]).map((a) => (
                  <div key={a.id} className="p-4 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">
                        {new Date(a.starts_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {a.customers?.name ?? "Cliente"}
                      </span>
                      <Badge variant="secondary">{a.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(a.appointment_services ?? [])
                        .map((s: any) => s.services?.name)
                        .filter(Boolean)
                        .join(", ") || "Serviço"}
                    </p>
                    {a.notes && <p className="text-xs text-muted-foreground mt-1">Obs.: {a.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Próximos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(data?.week ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Sem próximos atendimentos.</p>
            ) : (
              <div className="divide-y">
                {(data!.week as any[]).slice(0, 12).map((a) => (
                  <div key={a.id} className="p-3 text-sm flex justify-between gap-2">
                    <span>{a.customers?.name ?? "Cliente"}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.starts_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BadgePercent className="h-4 w-4" /> Minhas comissões
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 divide-x border-b">
              <div className="p-4">
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="text-lg font-semibold">{brl(kpi.pending / 100)}</p>
              </div>
              <div className="p-4">
                <p className="text-xs text-muted-foreground">Pago</p>
                <p className="text-lg font-semibold">{brl(kpi.paid / 100)}</p>
              </div>
            </div>
            {(data?.commissions ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Nenhuma comissão registrada.</p>
            ) : (
              <div className="divide-y max-h-72 overflow-y-auto">
                {(data!.commissions as any[]).map((c) => (
                  <div key={c.id} className="p-3 text-sm flex justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")} · {Number(c.rate ?? 0)}%
                    </span>
                    <span className="flex items-center gap-2">
                      {brl((c.amount_cents ?? 0) / 100)}
                      <Badge variant={c.status === "paid" ? "secondary" : "outline"}>
                        {c.status === "paid" ? "Pago" : "Pendente"}
                      </Badge>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Horários bloqueados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(data?.blocks ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Nenhum bloqueio nos próximos dias.</p>
            ) : (
              <div className="divide-y">
                {(data!.blocks as any[]).map((b) => (
                  <div key={b.id} className="p-3 text-sm flex justify-between gap-2">
                    <span>{b.reason ?? "Bloqueio"}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(b.starts_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-xs">{label}</span>
        </div>
        <p className="mt-1 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
