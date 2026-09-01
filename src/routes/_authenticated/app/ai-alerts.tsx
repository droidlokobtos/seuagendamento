import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAiAlertHistory } from "@/lib/ai-alerts.functions";
import { useCompany } from "@/lib/company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, History, Loader2, RefreshCw, RotateCcw, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/ai-alerts")({ component: AiAlertHistory });

const severityLabel: Record<string, string> = { critical: "Crítico", attention: "Atenção", opportunity: "Oportunidade", positive: "Positivo" };
const eventLabel: Record<string, string> = { opened: "Detectado", updated: "Evoluiu", resolved: "Resolvido", reopened: "Reaberto" };

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") return <ShieldAlert className="h-4 w-4 text-destructive" />;
  if (severity === "attention") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  if (severity === "positive") return <TrendingUp className="h-4 w-4 text-emerald-600" />;
  return <Sparkles className="h-4 w-4 text-primary" />;
}

function AiAlertHistory() {
  const { activeCompany } = useCompany();
  const getHistory = useServerFn(getAiAlertHistory);
  const query = useQuery({
    queryKey: ["ai-alert-history", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      if (!activeCompany) throw new Error("Selecione uma empresa");
      return getHistory({ data: { company_id: activeCompany.id } });
    },
    staleTime: 60_000,
  });

  const active = query.data?.active ?? [];
  const resolved = query.data?.resolved ?? [];
  const events = query.data?.events ?? [];
  const summary = query.data?.summary;

  return <div className="mx-auto max-w-6xl space-y-6 pb-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><History className="h-6 w-6" /></div>
        <div><p className="text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">Inteligência empresarial</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Evolução dos alertas</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Acompanhe quando cada situação surgiu, mudou, foi resolvida ou voltou a acontecer.</p></div>
      </div>
      <div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link to="/app/ai"><ArrowLeft className="mr-2 h-4 w-4" />Central IA</Link></Button><Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Atualizar</Button></div>
    </div>

    {query.isLoading ? <Card><CardContent className="flex items-center justify-center gap-3 py-14 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Carregando histórico...</CardContent></Card> : <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Em acompanhamento" value={summary?.active_count ?? 0} icon={Clock3} />
        <Metric label="Resolvidos" value={summary?.resolved_count ?? 0} icon={CheckCircle2} />
        <Metric label="Reaberturas" value={summary?.reopened_count ?? 0} icon={RotateCcw} />
      </div>

      <section className="space-y-3"><div><h2 className="text-lg font-semibold">Em acompanhamento</h2><p className="text-sm text-muted-foreground">Alertas que continuam presentes na análise mais recente.</p></div>{active.length === 0 ? <Empty text="Nenhum alerta ativo neste momento." /> : active.map((item: any) => <AlertCard key={item.id} item={item} />)}</section>

      <section className="space-y-3"><div><h2 className="text-lg font-semibold">Resolvidos automaticamente</h2><p className="text-sm text-muted-foreground">Situações que deixaram de ser detectadas nas análises seguintes.</p></div>{resolved.length === 0 ? <Empty text="Ainda não há alertas resolvidos registrados." /> : resolved.slice(0, 20).map((item: any) => <AlertCard key={item.id} item={item} resolved />)}</section>

      <section className="space-y-3"><div><h2 className="text-lg font-semibold">Linha do tempo</h2><p className="text-sm text-muted-foreground">Eventos significativos, sem repetir cada atualização automática do painel.</p></div><Card><CardContent className="p-0">{events.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">O histórico começará a ser preenchido conforme o Radar Inteligente acompanhar o negócio.</p> : events.slice(0, 60).map((event: any) => <div key={event.id} className="flex gap-4 border-b p-4 last:border-0 sm:p-5"><div className="mt-0.5"><SeverityIcon severity={event.severity} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-sm">{event.title}</p><Badge variant="outline">{eventLabel[event.event_type] ?? event.event_type}</Badge>{event.metric ? <Badge variant="secondary">{event.metric}</Badge> : null}</div><p className="mt-1 text-sm text-muted-foreground">{event.description}</p><p className="mt-2 text-xs text-muted-foreground">{formatDate(event.created_at)}</p></div></div>)}</CardContent></Card></section>
    </>}
  </div>;
}

function Metric({ label, value, icon: Icon }: any) { return <Card><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-semibold">{value}</p></CardContent></Card>; }

function AlertCard({ item, resolved = false }: any) { return <Card><CardContent className="p-5"><div className="flex gap-4"><div className="mt-0.5"><SeverityIcon severity={item.severity} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{item.title}</h3><Badge variant="outline">{severityLabel[item.severity] ?? item.severity}</Badge><Badge variant={resolved ? "secondary" : "outline"}>{resolved ? "Resolvido" : "Ativo"}</Badge>{item.metric ? <Badge variant="secondary">{item.metric}</Badge> : null}</div><p className="mt-2 text-sm text-muted-foreground">{item.description}</p><div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3"><span>Primeiro sinal: {formatDate(item.first_seen_at)}</span><span>Última detecção: {formatDate(item.last_seen_at)}</span><span>{resolved ? `Resolvido: ${formatDate(item.resolved_at)}` : `Ocorrências: ${item.occurrence_count}`}</span></div>{item.reopened_count > 0 && <p className="mt-2 text-xs font-medium">Este alerta já voltou a acontecer {item.reopened_count} vez(es).</p>}</div></div></CardContent></Card>; }

function Empty({ text }: { text: string }) { return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{text}</CardContent></Card>; }
