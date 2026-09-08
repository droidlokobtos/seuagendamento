import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { usePermissions } from "@/lib/use-permissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  brl,
  nextMonthStart,
  saoPauloDate,
  saoPauloDateAddDays,
  saoPauloDayStartIso,
} from "@/lib/format";
import {
  ArrowRight,
  BadgeCheck,
  BadgePercent,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Scissors,
  Sparkles,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";

const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const STATUS: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Agendado", className: "border-sky-200 bg-sky-50 text-sky-700" },
  confirmed: {
    label: "Confirmado",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  in_progress: {
    label: "Em atendimento",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  completed: { label: "Concluído", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  no_show: { label: "Não compareceu", className: "border-rose-200 bg-rose-50 text-rose-700" },
  cancelled: { label: "Cancelado", className: "border-slate-200 bg-slate-50 text-slate-600" },
  cancelled_by_customer: {
    label: "Cancelado pelo cliente",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  cancelled_by_company: {
    label: "Cancelado pela empresa",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

type Props = { requestedStaffId?: string | null; preview?: boolean };

const serviceNames = (appointment: any) =>
  (appointment?.appointment_services ?? [])
    .map((row: any) => row.services?.name)
    .filter(Boolean)
    .join(", ");
const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
const dateTimeLabel = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function ProfessionalDashboard({ requestedStaffId, preview = false }: Props) {
  const { activeCompany } = useCompany();
  const { membership, can, isAdmin, isProfessional } = usePermissions();
  const companyId = activeCompany?.id;
  // O parâmetro de pré-visualização só vale para administradores.
  const staffId = isProfessional
    ? (membership?.staffId ?? null)
    : isAdmin
      ? (requestedStaffId ?? null)
      : null;
  const today = saoPauloDate();
  const todayStart = saoPauloDayStartIso(today);
  const todayEnd = saoPauloDayStartIso(saoPauloDateAddDays(1, today));
  const weekEnd = saoPauloDayStartIso(saoPauloDateAddDays(8, today));
  const monthStart = saoPauloDayStartIso(`${today.slice(0, 7)}-01`);
  const monthEnd = saoPauloDayStartIso(nextMonthStart(today.slice(0, 7)));

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["professional-dashboard", companyId, staffId, today],
    enabled: !!companyId && !!staffId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const results = await Promise.all([
        supabase
          .from("staff")
          .select("id,name,role_title,photo_url,color,commission_pct,active")
          .eq("company_id", companyId!)
          .eq("id", staffId!)
          .maybeSingle(),
        supabase
          .from("appointments")
          .select(
            "id,starts_at,ends_at,status,notes,total_cents,customers(name),appointment_services(services(name))",
          )
          .eq("company_id", companyId!)
          .eq("staff_id", staffId!)
          .gte("starts_at", todayStart)
          .lt("starts_at", todayEnd)
          .order("starts_at"),
        supabase
          .from("appointments")
          .select(
            "id,starts_at,ends_at,status,customers(name),appointment_services(services(name))",
          )
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
          .select(
            "id,commission_cents,commission_type,commission_value,status,occurred_at,paid_at,service_name,customer_name",
          )
          .eq("company_id", companyId!)
          .eq("staff_id", staffId!)
          .eq("status", "pending")
          .order("occurred_at", { ascending: false }),
        supabase
          .from("commissions")
          .select(
            "id,commission_cents,commission_type,commission_value,status,occurred_at,paid_at,service_name,customer_name",
          )
          .eq("company_id", companyId!)
          .eq("staff_id", staffId!)
          .eq("status", "paid")
          .gte("paid_at", monthStart)
          .lt("paid_at", monthEnd)
          .order("paid_at", { ascending: false }),
        supabase
          .from("commissions")
          .select(
            "id,commission_cents,commission_type,commission_value,status,occurred_at,paid_at,service_name,customer_name",
          )
          .eq("company_id", companyId!)
          .eq("staff_id", staffId!)
          .order("occurred_at", { ascending: false })
          .limit(12),
        supabase
          .from("staff_services")
          .select(
            "service_id,services(id,name,duration_min,price_cents,has_commission,commission_type,commission_value,active)",
          )
          .eq("staff_id", staffId!),
        supabase
          .from("staff_schedules")
          .select("id,weekday,start_time,end_time")
          .eq("staff_id", staffId!)
          .order("weekday"),
      ]);
      const failure = results.find((result) => result.error)?.error;
      if (failure) throw failure;
      if (!results[0].data) throw new Error("Profissional não encontrado ou sem acesso ativo.");
      return {
        professional: results[0].data as any,
        today: (results[1].data ?? []) as any[],
        upcoming: (results[2].data ?? []) as any[],
        month: (results[3].data ?? []) as any[],
        pendingCommissions: (results[4].data ?? []) as any[],
        paidCommissions: (results[5].data ?? []) as any[],
        recentCommissions: (results[6].data ?? []) as any[],
        services: (results[7].data ?? []) as any[],
        schedules: (results[8].data ?? []) as any[],
      };
    },
  });

  const metrics = useMemo(() => {
    const month = data?.month ?? [];
    const completed = month.filter((appointment) => appointment.status === "completed");
    const produced = completed.reduce(
      (sum, appointment) =>
        sum +
        Math.max(0, Number(appointment.total_cents ?? 0) - Number(appointment.discount_cents ?? 0)),
      0,
    );
    const pending = (data?.pendingCommissions ?? []).reduce(
      (sum, row) => sum + Number(row.commission_cents ?? 0),
      0,
    );
    const paid = (data?.paidCommissions ?? []).reduce(
      (sum, row) => sum + Number(row.commission_cents ?? 0),
      0,
    );
    const activeToday = (data?.today ?? []).filter(
      (appointment) =>
        !String(appointment.status).startsWith("cancelled") && appointment.status !== "no_show",
    );
    const next = [...activeToday, ...(data?.upcoming ?? [])].find(
      (appointment) => new Date(appointment.starts_at).getTime() >= Date.now(),
    );
    return { completed: completed.length, produced, pending, paid, activeToday, next };
  }, [data]);

  if (!staffId)
    return (
      <Card className="mx-auto max-w-xl border-amber-200 bg-amber-50/60">
        <CardContent className="p-8 text-center">
          <UserRound className="mx-auto h-9 w-9 text-amber-700" />
          <h1 className="mt-3 text-lg font-semibold">
            {isAdmin ? "Selecione um profissional" : "Acesso ainda não vinculado"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isAdmin
              ? "Abra Equipe → Funcionários e escolha “Ver painel” no profissional desejado."
              : "Peça ao administrador para vincular seu usuário ao cadastro profissional em Usuários e permissões."}
          </p>
        </CardContent>
      </Card>
    );
  if (isLoading)
    return (
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-3xl bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  if (isError || !data)
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="p-8 text-center">
          <h1 className="text-lg font-semibold">Não foi possível carregar o painel</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Confira o vínculo do profissional e tente novamente.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );

  const professional = data.professional;
  const services = data.services
    .map((row) => row.services)
    .filter(Boolean)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary via-primary to-primary/85 p-6 text-primary-foreground shadow-sm md:p-8">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <Avatar
            className="h-16 w-16 border-2 border-white/30 shadow-lg md:h-20 md:w-20"
            style={{ background: professional.color ?? undefined }}
          >
            {professional.photo_url && (
              <AvatarImage src={professional.photo_url} alt={professional.name} />
            )}
            <AvatarFallback className="bg-white/15 text-xl text-white">
              {professional.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
                {preview ? "Pré-visualização do Admin" : "Painel do profissional"}
              </p>
              {professional.active ? (
                <Badge className="border-white/20 bg-white/15 text-white">Ativo</Badge>
              ) : (
                <Badge variant="destructive">Inativo</Badge>
              )}
            </div>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight md:text-3xl">
              {professional.name}
            </h1>
            <p className="mt-1 text-sm text-primary-foreground/75">
              {professional.role_title || "Profissional"} · {activeCompany?.name}
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs text-primary-foreground/65">Próximo atendimento</p>
            <p className="mt-1 font-semibold">
              {metrics.next ? dateTimeLabel(metrics.next.starts_at) : "Agenda livre"}
            </p>
            {metrics.next && (
              <p className="text-xs text-primary-foreground/70">
                {metrics.next.customers?.name ?? "Cliente"}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={CalendarDays}
          label="Atendimentos hoje"
          value={String(metrics.activeToday.length)}
          hint="somente sua agenda"
        />
        {can("desempenho") && (
          <Kpi
            icon={CheckCircle2}
            label="Concluídos no mês"
            value={String(metrics.completed)}
            hint={`Produção: ${brl(metrics.produced / 100)}`}
          />
        )}
        {can("comissoes") && (
          <Kpi
            icon={Wallet}
            label="Comissão a receber"
            value={brl(metrics.pending / 100)}
            hint="valores pendentes"
            accent
          />
        )}
        {can("comissoes") && (
          <Kpi
            icon={BadgeCheck}
            label="Comissão paga no mês"
            value={brl(metrics.paid / 100)}
            hint="pagamentos confirmados"
          />
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-3 border-b bg-muted/20">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" /> Agenda de hoje
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Clientes e serviços destinados a você.
              </p>
            </div>
            {can("agenda") && (
              <Button asChild size="sm" variant="outline">
                <Link to="/app/agenda">
                  Agenda completa <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {!metrics.activeToday.length ? (
              <EmptyState icon={Calendar} text="Nenhum atendimento ativo para hoje." />
            ) : (
              <div className="divide-y">
                {metrics.activeToday.map((appointment) => {
                  const status = STATUS[appointment.status] ?? {
                    label: appointment.status,
                    className: "",
                  };
                  return (
                    <div
                      key={appointment.id}
                      className="grid gap-3 p-4 transition-colors hover:bg-muted/25 sm:grid-cols-[72px_1fr_auto] sm:items-center"
                    >
                      <div>
                        <p className="text-lg font-semibold tabular-nums">
                          {timeLabel(appointment.starts_at)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          até {timeLabel(appointment.ends_at)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {appointment.customers?.name ?? "Cliente"}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {serviceNames(appointment) || "Serviço não informado"}
                        </p>
                        {appointment.notes && (
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            Observação: {appointment.notes}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className={status.className}>
                        {status.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scissors className="h-4 w-4 text-primary" /> Meus serviços
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Serviços habilitados pela empresa para sua agenda.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {!services.length ? (
              <EmptyState icon={Scissors} text="Nenhum serviço foi vinculado ao seu perfil." />
            ) : (
              <div className="max-h-[360px] divide-y overflow-y-auto">
                {services.map((service) => (
                  <div key={service.id} className="flex items-center gap-3 p-4">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Scissors className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{service.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {service.duration_min} min · {brl(Number(service.price_cents ?? 0) / 100)}
                      </p>
                    </div>
                    {!service.active ? (
                      <Badge variant="secondary">Inativo</Badge>
                    ) : service.has_commission ? (
                      <Badge variant="outline">
                        {service.commission_type === "fixed"
                          ? brl(Number(service.commission_value ?? 0))
                          : `${Number(service.commission_value ?? 0)}%`}
                      </Badge>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" /> Próximos 7 dias
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Seus próximos compromissos confirmados e agendados.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {!data.upcoming.length ? (
              <EmptyState icon={CalendarDays} text="Nenhum próximo atendimento." />
            ) : (
              <div className="max-h-80 divide-y overflow-y-auto">
                {data.upcoming.slice(0, 15).map((appointment) => (
                  <div key={appointment.id} className="flex items-center gap-3 p-4">
                    <div className="min-w-[82px] text-sm font-medium">
                      {dateTimeLabel(appointment.starts_at)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {appointment.customers?.name ?? "Cliente"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {serviceNames(appointment) || "Serviço"}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {STATUS[appointment.status]?.label ?? appointment.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {can("comissoes") && (
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 border-b bg-muted/20">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BadgePercent className="h-4 w-4 text-primary" /> Movimentação de comissões
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Valores calculados após a conclusão dos atendimentos.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/app/commissions">
                  Ver extrato <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {!data.recentCommissions.length ? (
                <EmptyState icon={Wallet} text="Nenhuma comissão registrada." />
              ) : (
                <div className="max-h-80 divide-y overflow-y-auto">
                  {data.recentCommissions.map((commission) => (
                    <div key={commission.id} className="flex items-center gap-3 p-4">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {commission.service_name || "Serviço"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {commission.customer_name || "Cliente"} ·{" "}
                          {new Date(commission.occurred_at).toLocaleDateString("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {brl(Number(commission.commission_cents ?? 0) / 100)}
                        </p>
                        <Badge variant={commission.status === "paid" ? "secondary" : "outline"}>
                          {commission.status === "paid"
                            ? "Pago"
                            : commission.status === "cancelled"
                              ? "Cancelado"
                              : "A receber"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Jornada de trabalho
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Horários definidos pela administração para este profissional.
          </p>
        </CardHeader>
        <CardContent className="p-4">
          {!data.schedules.length ? (
            <p className="text-sm text-muted-foreground">
              Segue o horário geral configurado pela empresa.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {data.schedules.map((schedule) => (
                <div key={schedule.id} className="rounded-xl border bg-muted/15 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    {WEEKDAYS[Number(schedule.weekday)]}
                  </p>
                  <p className="text-sm font-medium">
                    {String(schedule.start_time).slice(0, 5)} às{" "}
                    {String(schedule.end_time).slice(0, 5)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  accent = false,
}: {
  icon: any;
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/[0.035]" : ""}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div
            className={`grid h-9 w-9 place-items-center rounded-xl ${accent ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-10 text-center text-muted-foreground">
      <Icon className="h-7 w-7 opacity-60" />
      <p className="mt-2 text-sm">{text}</p>
    </div>
  );
}
