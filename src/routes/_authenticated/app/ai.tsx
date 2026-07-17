import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { askAssistant } from "@/lib/ai.functions";
import { useCompany } from "@/lib/company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/ai")({
  component: AiAssistant,
});

const SUGGESTIONS = [
  "Quais os melhores horários para promover promoções esta semana?",
  "Faça uma previsão de faturamento para o próximo mês.",
  "Quais clientes estão inativos e devem ser reengajados?",
  "Sugira 3 campanhas de marketing para aumentar meu ticket médio.",
  "Quais serviços têm menor demanda e como posso impulsioná-los?",
];

function AiAssistant() {
  const { activeCompany } = useCompany();
  const ask = useServerFn(askAssistant);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);

  const run = useMutation({
    mutationFn: async (q: string) => {
      if (!activeCompany) throw new Error("Selecione uma empresa");
      return ask({ data: { company_id: activeCompany.id, question: q } });
    },
    onSuccess: (res, q) => {
      setHistory((h) => [{ q, a: res.answer }, ...h]);
      setQuestion("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const submit = () => {
    const q = question.trim();
    if (!q) return;
    run.mutate(q);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Assistente Inteligente</h2>
          <p className="text-sm text-muted-foreground">Sugestão de horários, previsão de faturamento, análise de clientes.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Textarea
            rows={3}
            placeholder="Pergunte algo sobre seu negócio…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
          />
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Button key={s} variant="outline" size="sm" onClick={() => { setQuestion(s); }}>
                {s}
              </Button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={run.isPending || !question.trim()}>
              {run.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {run.isPending ? "Analisando…" : "Perguntar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {history.map((h, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">Você perguntou</CardTitle>
              <p className="text-base font-medium">{h.q}</p>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{h.a}</div>
            </CardContent>
          </Card>
        ))}
        {history.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Faça uma pergunta ou escolha uma sugestão acima.
          </p>
        )}
      </div>
    </div>
  );
}
