import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { askAssistant } from "@/lib/ai.functions";
import { useCompany } from "@/lib/company";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BrainCircuit, Send, Loader2, TrendingUp, Users, CalendarRange, CircleDollarSign, Target, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/ai")({ component: AiAssistant });

const SUGGESTIONS = [
  { icon: TrendingUp, label: "Analisar desempenho", prompt: "Analise o desempenho da empresa nos últimos 90 dias. Mostre tendências, riscos, oportunidades e as 3 ações de maior prioridade." },
  { icon: CircleDollarSign, label: "Aumentar faturamento", prompt: "Com base nos meus dados, quais são as melhores oportunidades para aumentar faturamento e ticket médio sem depender apenas de descontos?" },
  { icon: Users, label: "Recuperar clientes", prompt: "Analise retenção e clientes inativos. Quem merece atenção e qual estratégia de reengajamento você recomenda?" },
  { icon: CalendarRange, label: "Otimizar agenda", prompt: "Analise dias e horários de maior e menor demanda e sugira como melhorar a ocupação da agenda." },
  { icon: Target, label: "Plano de crescimento", prompt: "Crie um plano de crescimento prático para os próximos 30 dias usando os dados atuais da empresa, com metas e prioridades." },
];

function AiAssistant() {
  const { activeCompany } = useCompany();
  const ask = useServerFn(askAssistant);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);
  const run = useMutation({
    mutationFn: async (q: string) => {
      if (!activeCompany) throw new Error("Selecione uma empresa");
      return ask({ data: { company_id: activeCompany.id, question: q, history: [...history].reverse().slice(-8) } });
    },
    onSuccess: (res, q) => { setHistory(h => [...h, { q, a: res.answer }]); setQuestion(""); },
    onError: e => toast.error(e instanceof Error ? e.message : "Não foi possível concluir a análise"),
  });
  const submit = (text?: string) => { const q = (text ?? question).trim(); if (q && !run.isPending) run.mutate(q); };

  return <div className="max-w-5xl mx-auto space-y-6 pb-8">
    <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4"><div className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 grid place-items-center"><BrainCircuit className="h-6 w-6 text-primary" /></div><div><p className="text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">Inteligência empresarial</p><h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">Consultor IA</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Analisa os dados reais da empresa para apoiar decisões de faturamento, agenda, clientes, serviços e equipe.</p></div></div>
        {history.length > 0 && <Button variant="ghost" size="sm" onClick={() => setHistory([])}><RotateCcw className="h-4 w-4 mr-2" />Nova análise</Button>}
      </div>
    </div>

    {history.length === 0 && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{SUGGESTIONS.map(({icon:Icon,label,prompt}) => <button key={label} onClick={() => submit(prompt)} className="text-left rounded-xl border bg-card p-4 transition hover:border-primary/30 hover:shadow-sm"><Icon className="h-5 w-5 text-primary mb-3"/><p className="font-medium text-sm">{label}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{prompt}</p></button>)}</div>}

    <div className="space-y-4">{history.map((h,i) => <div key={i} className="space-y-3"><div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">{h.q}</div></div><Card className="border-muted"><CardHeader className="pb-0"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><BrainCircuit className="h-4 w-4"/>ANÁLISE DO CONSULTOR IA</div></CardHeader><CardContent className="pt-4"><div className="whitespace-pre-wrap text-sm leading-7">{h.a}</div></CardContent></Card></div>)}</div>

    <Card className="sticky bottom-4 shadow-lg"><CardContent className="p-4"><Textarea rows={3} placeholder="Pergunte sobre faturamento, clientes, agenda, serviços, equipe ou peça uma análise completa..." value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }} /><div className="mt-3 flex items-center justify-between gap-3"><p className="hidden sm:block text-xs text-muted-foreground">A IA usa os dados disponíveis da empresa. Projeções são estimativas.</p><Button className="ml-auto" onClick={() => submit()} disabled={run.isPending || !question.trim()}>{run.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Send className="h-4 w-4 mr-2"/>}{run.isPending ? "Analisando dados..." : "Analisar"}</Button></div></CardContent></Card>
  </div>;
}
