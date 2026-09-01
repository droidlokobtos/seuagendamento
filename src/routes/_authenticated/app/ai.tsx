import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { askAssistant, getBusinessIntelligence } from "@/lib/ai.functions";
import { useCompany } from "@/lib/company";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, BrainCircuit, CalendarRange, CircleDollarSign, Loader2, Radar, RotateCcw, Send, ShieldAlert, Sparkles, TrendingDown, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/ai")({ component: AiAssistant });

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const SUGGESTIONS = [
  { icon: TrendingUp, label: "Analisar desempenho", prompt: "Analise o desempenho da empresa nos últimos 90 dias. Mostre tendências, riscos, oportunidades e as 3 ações de maior prioridade." },
  { icon: CircleDollarSign, label: "Aumentar faturamento", prompt: "Com base nos meus dados, quais são as melhores oportunidades para aumentar faturamento e ticket médio sem depender apenas de descontos?" },
  { icon: Users, label: "Recuperar clientes", prompt: "Analise os clientes em risco de não retornar e monte uma estratégia de recuperação priorizando os casos mais importantes." },
  { icon: CalendarRange, label: "Otimizar agenda", prompt: "Analise dias e horários de maior e menor demanda e sugira como melhorar a ocupação da agenda." },
];

function AiAssistant() {
  const { activeCompany } = useCompany();
  const ask = useServerFn(askAssistant);
  const getIntel = useServerFn(getBusinessIntelligence);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);

  const intelQuery = useQuery({
    queryKey: ["business-intelligence", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      if (!activeCompany) throw new Error("Selecione uma empresa");
      return getIntel({ data: { company_id: activeCompany.id } });
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  const run = useMutation({
    mutationFn: async (q: string) => {
      if (!activeCompany) throw new Error("Selecione uma empresa");
      return ask({ data: { company_id: activeCompany.id, question: q, history: history.slice(-8) } });
    },
    onSuccess: (res, q) => { setHistory(h => [...h, { q, a: res.answer }]); setQuestion(""); },
    onError: e => toast.error(e instanceof Error ? e.message : "Não foi possível concluir a análise"),
  });

  const submit = (text?: string) => {
    const q = (text ?? question).trim();
    if (q && !run.isPending) run.mutate(q);
  };

  const intelligence = intelQuery.data?.intelligence as any;
  const radarItems = intelligence?.radar ?? [];
  const forecast = intelligence?.forecast;
  const riskCustomers = intelligence?.customers_at_risk ?? [];
  const summary = intelligence?.proactive_summary;
  const topPriority = summary?.top_priority;

  const severityMeta = useMemo(() => ({
    critical: { label: "Crítico", icon: ShieldAlert, className: "border-destructive/30 bg-destructive/5 text-destructive" },
    attention: { label: "Atenção", icon: AlertTriangle, className: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300" },
    opportunity: { label: "Oportunidade", icon: Sparkles, className: "border-primary/30 bg-primary/5 text-primary" },
    positive: { label: "Positivo", icon: TrendingUp, className: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300" },
  }), []);

  return <div className="max-w-6xl mx-auto space-y-6 pb-8">
    <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
        <div className="flex gap-4">
          <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 grid place-items-center"><BrainCircuit className="h-6 w-6 text-primary" /></div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">Inteligência empresarial</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">Central de Inteligência IA</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">O sistema analisa automaticamente faturamento, comportamento de clientes, agenda e sinais de risco para mostrar o que merece atenção antes mesmo de você perguntar.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => intelQuery.refetch()} disabled={intelQuery.isFetching}><RotateCcw className={`h-4 w-4 mr-2 ${intelQuery.isFetching ? "animate-spin" : ""}`} />Atualizar análise</Button>
      </div>
    </div>

    {intelQuery.isLoading ? <Card><CardContent className="py-12 flex items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Analisando o negócio...</CardContent></Card> : (
      <>
        {topPriority && <Card className="border-primary/20 bg-primary/[0.025]"><CardContent className="p-5 sm:p-6"><div className="flex flex-col sm:flex-row sm:items-center gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Radar className="h-5 w-5" /></div><div className="flex-1"><p className="text-xs uppercase tracking-[.14em] text-muted-foreground font-medium">Prioridade detectada automaticamente</p><h2 className="mt-1 font-semibold">{topPriority.title}</h2><p className="mt-1 text-sm text-muted-foreground">{topPriority.description}</p></div><Button size="sm" onClick={() => submit(`Analise esta prioridade detectada pelo Radar Inteligente e crie um plano de ação prático: ${topPriority.title}. ${topPriority.description}`)}>Analisar com IA</Button></div></CardContent></Card>}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Alertas críticos" value={summary?.critical_count ?? 0} icon={ShieldAlert} />
          <MetricCard label="Pontos de atenção" value={summary?.attention_count ?? 0} icon={AlertTriangle} />
          <MetricCard label="Oportunidades" value={summary?.opportunity_count ?? 0} icon={Sparkles} />
          <MetricCard label="Clientes em risco" value={riskCustomers.length} icon={Users} />
        </div>
      </>
    )}

    <Tabs defaultValue="radar" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
        <TabsTrigger value="radar" className="gap-2 py-2.5"><Radar className="h-4 w-4" />Radar Inteligente</TabsTrigger>
        <TabsTrigger value="forecast" className="gap-2 py-2.5"><TrendingUp className="h-4 w-4" />Previsão</TabsTrigger>
        <TabsTrigger value="risk" className="gap-2 py-2.5"><Users className="h-4 w-4" />Clientes em risco</TabsTrigger>
        <TabsTrigger value="consultant" className="gap-2 py-2.5"><BrainCircuit className="h-4 w-4" />Consultor IA</TabsTrigger>
      </TabsList>

      <TabsContent value="radar" className="space-y-3">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Radar Inteligente</h2><p className="text-sm text-muted-foreground">Problemas, oportunidades e sinais positivos identificados automaticamente.</p></div></div>
        {radarItems.length === 0 ? <EmptyState text="Ainda não há dados suficientes para gerar alertas." /> : radarItems.map((item: any) => {
          const meta = severityMeta[item.severity as keyof typeof severityMeta] ?? severityMeta.attention;
          const Icon = meta.icon;
          return <Card key={item.id}><CardContent className="p-5"><div className="flex gap-4"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${meta.className}`}><Icon className="h-5 w-5" /></div><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{item.title}</h3><Badge variant="outline">{meta.label}</Badge>{item.metric ? <Badge variant="secondary">{item.metric}</Badge> : null}</div><p className="mt-2 text-sm text-muted-foreground">{item.description}</p><div className="mt-3 flex flex-wrap items-center gap-3"><p className="text-xs"><span className="font-medium">Ação sugerida:</span> {item.action}</p><Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => submit(`Aprofunde este alerta do Radar Inteligente e me diga exatamente o que fazer: ${item.title}. ${item.description}. Ação sugerida: ${item.action}`)}>Aprofundar com IA</Button></div></div></div></CardContent></Card>;
        })}
      </TabsContent>

      <TabsContent value="forecast" className="space-y-4">
        <div><h2 className="text-lg font-semibold">Previsão de faturamento</h2><p className="text-sm text-muted-foreground">Estimativa baseada exclusivamente no histórico recente da empresa.</p></div>
        {!forecast ? <EmptyState text="Ainda não há dados suficientes para calcular a previsão." /> : <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Previsão próximos 30 dias" value={money.format(forecast.faturamento_previsto_brl ?? 0)} icon={TrendingUp} />
            <MetricCard label="Últimos 30 dias" value={money.format(forecast.faturamento_ultimos_30d_brl ?? 0)} icon={CircleDollarSign} />
            <MetricCard label="30 dias anteriores" value={money.format(forecast.faturamento_30d_anterior_brl ?? 0)} icon={CircleDollarSign} />
            <MetricCard label="Tendência" value={forecast.tendencia_pct === null ? "Sem base" : `${forecast.tendencia_pct > 0 ? "+" : ""}${forecast.tendencia_pct}%`} icon={forecast.tendencia_pct < 0 ? TrendingDown : TrendingUp} />
          </div>
          <Card><CardContent className="p-5"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><div className="flex items-center gap-2"><p className="font-medium">Confiabilidade da estimativa</p><Badge variant="outline">{String(forecast.confianca).toUpperCase()}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{forecast.metodologia}</p><p className="mt-1 text-xs text-muted-foreground">A previsão é uma estimativa e não representa garantia de faturamento futuro.</p></div><Button onClick={() => submit("Analise minha previsão de faturamento para os próximos 30 dias. Explique os principais fatores de risco e indique 3 ações concretas para melhorar o resultado previsto.")}>Criar plano para a previsão</Button></div></CardContent></Card>
        </>}
      </TabsContent>

      <TabsContent value="risk" className="space-y-4">
        <div><h2 className="text-lg font-semibold">Clientes em risco de não retornar</h2><p className="text-sm text-muted-foreground">O sistema compara a frequência histórica de cada cliente com o tempo desde a última visita.</p></div>
        {riskCustomers.length === 0 ? <EmptyState text="Nenhum cliente com padrão suficiente de visitas está em risco neste momento." /> : <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="text-left p-3 pl-5">Cliente</th><th className="text-left p-3">Risco</th><th className="text-left p-3">Frequência média</th><th className="text-left p-3">Sem retornar</th><th className="text-left p-3">Atraso estimado</th><th className="text-right p-3 pr-5">Ação</th></tr></thead><tbody>{riskCustomers.map((c: any) => <tr key={c.customer_id} className="border-t"><td className="p-3 pl-5"><p className="font-medium">{c.nome}</p><p className="text-xs text-muted-foreground">{c.visitas_180d} visitas analisadas</p></td><td className="p-3"><Badge variant={c.nivel === "alto" ? "destructive" : "outline"}>{c.risco_score}/100 · {c.nivel}</Badge></td><td className="p-3 text-muted-foreground">{c.frequencia_media_dias} dias</td><td className="p-3 text-muted-foreground">{c.dias_desde_ultima_visita} dias</td><td className="p-3 text-muted-foreground">+{c.atraso_estimado_dias} dias</td><td className="p-3 pr-5 text-right"><Button variant="ghost" size="sm" onClick={() => submit(`Analise o risco de perda deste cliente e sugira uma abordagem de recuperação sem inventar dados: ${c.nome}, frequência média ${c.frequencia_media_dias} dias, está há ${c.dias_desde_ultima_visita} dias sem retornar, score ${c.risco_score}/100.`)}>Analisar</Button></td></tr>)}</tbody></table></div></CardContent></Card>}
      </TabsContent>

      <TabsContent value="consultant" className="space-y-4">
        {history.length === 0 && <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{SUGGESTIONS.map(({ icon: Icon, label, prompt }) => <button key={label} onClick={() => submit(prompt)} className="text-left rounded-xl border bg-card p-4 transition hover:border-primary/30 hover:shadow-sm"><Icon className="h-5 w-5 text-primary mb-3" /><p className="font-medium text-sm">{label}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{prompt}</p></button>)}</div>}
        {history.length > 0 && <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={() => setHistory([])}><RotateCcw className="h-4 w-4 mr-2" />Nova análise</Button></div>}
        <div className="space-y-4">{history.map((h, i) => <div key={i} className="space-y-3"><div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">{h.q}</div></div><Card className="border-muted"><CardHeader className="pb-0"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><BrainCircuit className="h-4 w-4" />ANÁLISE DO CONSULTOR IA</div></CardHeader><CardContent className="pt-4"><div className="whitespace-pre-wrap text-sm leading-7">{h.a}</div></CardContent></Card></div>)}</div>
        <Card className="sticky bottom-4 shadow-lg"><CardContent className="p-4"><Textarea rows={3} placeholder="Pergunte sobre faturamento, clientes, agenda, riscos ou peça uma análise completa..." value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }} /><div className="mt-3 flex items-center justify-between gap-3"><p className="hidden sm:block text-xs text-muted-foreground">A IA usa os dados disponíveis da empresa. Projeções são estimativas.</p><Button className="ml-auto" onClick={() => submit()} disabled={run.isPending || !question.trim()}>{run.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}{run.isPending ? "Analisando dados..." : "Analisar"}</Button></div></CardContent></Card>
      </TabsContent>
    </Tabs>
  </div>;
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return <Card><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold tracking-tight">{value}</p></div><div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div></div></CardContent></Card>;
}

function EmptyState({ text }: { text: string }) {
  return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{text}</CardContent></Card>;
}
