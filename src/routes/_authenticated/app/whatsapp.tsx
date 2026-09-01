import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageCircle, Check, Copy, RefreshCw, Loader2, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";
import { openWhatsAppLink, waLink, waNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/whatsapp")({
  component: WhatsAppQueue,
});

const KIND_LABEL: Record<string, string> = {
  reminder_24h: "Lembrete 24h",
  reminder_1h: "Lembrete 1h",
  reminder_review: "Pedir avaliação",
};

type Template = { id: string; label: string; emoji: string; body: string };

const TEMPLATES: Template[] = [
  {
    id: "confirmacao",
    label: "Confirmação de horário",
    emoji: "✅",
    body: "Olá {{nome}}! ✅\n\nConfirmando seu horário na *{{empresa}}*.\nQualquer alteração, é só me avisar por aqui. Até já! ✨",
  },
  {
    id: "boas_vindas",
    label: "Boas-vindas novo cliente",
    emoji: "👋",
    body: "Oi {{nome}}! 👋 Seja muito bem-vindo(a) à *{{empresa}}*.\n\nEstamos felizes em te receber. Qualquer dúvida, estou por aqui! 💛",
  },
  {
    id: "retorno",
    label: "Convite para retorno",
    emoji: "💇",
    body: "Oi {{nome}}! 💇 Já faz um tempinho desde sua última visita à *{{empresa}}*.\nQue tal agendar um novo horário? Posso te ajudar a escolher o melhor dia. ✨",
  },
  {
    id: "aniversario",
    label: "Aniversário do cliente",
    emoji: "🎉",
    body: "Feliz aniversário, {{nome}}! 🎉🎂\n\nA equipe da *{{empresa}}* deseja um dia incrível.\nTemos um mimo especial esperando por você este mês. 💛",
  },
  {
    id: "promocao",
    label: "Promoção da semana",
    emoji: "🔥",
    body: "Oi {{nome}}! 🔥 Promoção da semana na *{{empresa}}*.\n\nCondição especial válida por poucos dias. Quer que eu já reserve um horário para você?",
  },
  {
    id: "agradecimento",
    label: "Agradecimento pós-atendimento",
    emoji: "💛",
    body: "Oi {{nome}}! 💛 Obrigado por escolher a *{{empresa}}* hoje.\nEsperamos você em breve! ✨",
  },
  {
    id: "no_show",
    label: "Falta / reagendar",
    emoji: "🗓️",
    body: "Oi {{nome}}! 🗓️ Notamos que não conseguimos te atender no horário marcado.\nPosso te encaixar em um novo dia? Me avise por aqui.",
  },
  {
    id: "cashback",
    label: "Cashback disponível",
    emoji: "💰",
    body: "Oi {{nome}}! 💰 Você tem cashback disponível na *{{empresa}}*.\nUse no seu próximo agendamento. Quer que eu reserve um horário?",
  },
];

function WhatsAppQueue() {
  const { activeCompany } = useCompany();
  const qc = useQueryClient();
  const companyId = activeCompany?.id;

  const {
    data = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["wa-queue", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("company_id", companyId)
        .in("kind", ["reminder_24h", "reminder_1h", "reminder_review"])
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    enabled: !!companyId,
    refetchInterval: 60_000,
  });

  const markSent = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["wa-queue", companyId] });
    qc.invalidateQueries({ queryKey: ["notifications", companyId] });
  };

  const openWa = (n: any) => {
    if (!n.metadata?.wa_url) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    const opened = openWhatsAppLink(n.metadata.wa_url);
    if (!opened) toast.error("O navegador bloqueou a abertura do WhatsApp");
  };

  const copyMsg = async (n: any) => {
    await navigator.clipboard.writeText(n.metadata?.message ?? "");
    toast.success("Mensagem copiada");
  };

  const runNow = async () => {
    try {
      if (!companyId) throw new Error("Selecione uma empresa");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente.");
      const res = await fetch("/api/public/hooks/reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ company_id: companyId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Falha ao processar lembretes");
      toast.success(`${j.processed ?? 0} lembretes gerados`);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao processar");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Fila de lembretes prontos para envio. Clique em "Enviar" e o WhatsApp abre com a
            mensagem preenchida.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={runNow} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Processar agora
        </Button>
      </div>

      <QuickSend companyId={companyId} companyName={activeCompany?.name ?? ""} />

      <div>
        <h2 className="text-lg font-semibold mb-2">Fila de lembretes</h2>
        {isLoading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data.length ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-3 opacity-40" />
              Nenhum lembrete pendente no momento.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.map((n: any) => (
              <Card key={n.id}>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{KIND_LABEL[n.kind] ?? n.kind}</Badge>
                    <CardTitle className="text-base">
                      {n.metadata?.customer_name ?? "Cliente"}
                    </CardTitle>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("pt-BR")}
                  </span>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {n.metadata?.phone ?? "Sem telefone"}
                  </p>
                  <pre className="whitespace-pre-wrap text-sm bg-muted/50 rounded-md p-3 font-sans">
                    {n.metadata?.message}
                  </pre>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => openWa(n)} disabled={!n.metadata?.wa_url}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Enviar no WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => copyMsg(n)}>
                      <Copy className="h-4 w-4 mr-2" /> Copiar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => markSent(n.id)}>
                      <Check className="h-4 w-4 mr-2" /> Marcar como enviado
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickSend({ companyId, companyName }: { companyId?: string; companyName: string }) {
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id);
  const [customerId, setCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const [message, setMessage] = useState<string>(TEMPLATES[0].body);

  const { data: customers = [] } = useQuery({
    queryKey: ["wa-customers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id,name,phone,whatsapp")
        .eq("company_id", companyId!)
        .or("phone.not.is.null,whatsapp.not.is.null")
        .order("name")
        .limit(500);
      return (data ?? []) as Array<{
        id: string;
        name: string;
        phone: string | null;
        whatsapp: string | null;
      }>;
    },
  });

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLocaleLowerCase("pt-BR");
    if (!term) return customers.slice(0, 50);
    return customers.filter((c) => c.name.toLocaleLowerCase("pt-BR").includes(term)).slice(0, 50);
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId],
  );

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (tpl) setMessage(tpl.body);
  };

  const finalMessage = useMemo(() => {
    const nome = selectedCustomer?.name ?? manualName ?? "";
    return message
      .replaceAll("{{nome}}", nome || "cliente")
      .replaceAll("{{empresa}}", companyName || "nossa loja");
  }, [message, selectedCustomer, manualName, companyName]);

  const selectedPhone = selectedCustomer?.whatsapp || selectedCustomer?.phone || manualPhone;
  const normalizedPhone = waNumber(selectedPhone);
  const waUrl = normalizedPhone ? waLink(normalizedPhone, finalMessage) : null;

  const send = () => {
    if (!waUrl) {
      toast.error("Informe um telefone válido");
      return;
    }
    const opened = openWhatsAppLink(waUrl);
    if (!opened) toast.error("O navegador bloqueou a abertura do WhatsApp");
  };

  const copy = async () => {
    await navigator.clipboard.writeText(finalMessage);
    toast.success("Mensagem copiada");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Envio rápido com modelos prontos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={templateId === t.id ? "default" : "outline"}
              onClick={() => applyTemplate(t.id)}
            >
              <span className="mr-1">{t.emoji}</span>
              {t.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Cliente cadastrado</Label>
            <Input
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Digite o nome do cliente…"
              autoComplete="off"
              className="mb-2"
            />
            <Select
              value={customerId}
              onValueChange={(v) => {
                setCustomerId(v);
                setCustomerSearch("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {filteredCustomers.length ? (
                  filteredCustomers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {c.whatsapp || c.phone}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhum cliente encontrado.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Ou nome</Label>
              <Input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Nome"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
        </div>

        <div>
          <Label>Mensagem</Label>
          <Textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
          <p className="text-xs text-muted-foreground mt-1">
            Variáveis: <code>{"{{nome}}"}</code> e <code>{"{{empresa}}"}</code>
          </p>
        </div>

        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Prévia</p>
          <pre className="whitespace-pre-wrap text-sm font-sans">{finalMessage}</pre>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={send} disabled={!waUrl}>
            <Send className="h-4 w-4 mr-2" /> Enviar no WhatsApp
          </Button>
          <Button variant="outline" onClick={copy}>
            <Copy className="h-4 w-4 mr-2" /> Copiar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
