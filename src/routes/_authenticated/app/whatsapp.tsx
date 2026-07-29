import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MessageCircle, Copy, RefreshCw, Loader2, Send, X, Check } from "lucide-react";
import { toast } from "sonner";
import {
  WA_EVENTS, WA_MESSAGE_STATUS, WA_VARIABLES, DEFAULT_TEMPLATES,
  renderWaTemplate, waDigits, waUrlFor, type WaEvent,
} from "@/lib/whatsapp";
import { useWaTemplates, sendWaLink } from "@/lib/wa-client";

export const Route = createFileRoute("/_authenticated/app/whatsapp")({
  component: WhatsAppPage,
});

function WhatsAppPage() {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Envio por link oficial (wa.me) — sem API, token ou integração. O sistema monta a mensagem,
          abre o WhatsApp Desktop (ou Web) e o atendente só clica em enviar.
        </p>
      </div>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Fila de mensagens</TabsTrigger>
          <TabsTrigger value="templates">Modelos</TabsTrigger>
          <TabsTrigger value="quick">Envio rápido</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="mt-4">
          <Queue companyId={companyId} />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <TemplatesManager companyId={companyId} />
        </TabsContent>
        <TabsContent value="quick" className="mt-4">
          <QuickSend companyId={companyId} companyName={activeCompany?.name ?? ""} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Fila de mensagens ---------------- */
function Queue({ companyId }: { companyId?: string }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("open");

  const { data = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["wa-queue", companyId, status],
    enabled: !!companyId,
    refetchInterval: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("whatsapp_messages")
        .select("*, customers(name, phone, whatsapp)")
        .eq("company_id", companyId!)
        .order("scheduled_for", { ascending: false })
        .limit(200);
      if (status === "open") q = q.in("status", ["pending", "opened", "failed"]);
      else if (status !== "all") q = q.eq("status", status);
      const { data } = await q;
      return data ?? [];
    },
  });

  const setMsgStatus = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: string }) => {
      const { error } = await supabase
        .from("whatsapp_messages")
        .update({ status: next, sent_at: next === "sent" ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-queue", companyId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const openWa = (m: any) => {
    const phone = m.to_phone || m.customers?.whatsapp || m.customers?.phone;
    if (!waDigits(phone)) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    window.open(m.wa_url || waUrlFor(phone, m.content), "_blank", "noopener");
    setMsgStatus.mutate({ id: m.id, next: "opened" });
  };

  const runNow = async () => {
    try {
      const res = await fetch("/api/public/hooks/reminders", { method: "POST" });
      const j = await res.json();
      toast.success(`${j.processed ?? 0} mensagens geradas`);
      refetch();
    } catch {
      toast.error("Falha ao processar");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Em aberto</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="opened">Abertas</SelectItem>
            <SelectItem value="sent">Enviadas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
            <SelectItem value="all">Todas</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={runNow} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Gerar pendentes agora
        </Button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data.length ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-3 opacity-40" />
            Nenhuma mensagem nesta visão.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((m: any) => {
            const st = WA_MESSAGE_STATUS[m.status] ?? WA_MESSAGE_STATUS.pending;
            const ev = WA_EVENTS.find((e) => e.id === m.event);
            const when = new Date(m.scheduled_for ?? m.created_at);
            return (
              <Card key={m.id}>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0 gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{ev ? `${ev.emoji} ${ev.label}` : m.event}</Badge>
                    <CardTitle className="text-base">{m.customers?.name ?? "Cliente"}</CardTitle>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${st.className}`}>{st.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {when.toLocaleDateString("pt-BR")} · {when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {m.to_phone || m.customers?.whatsapp || m.customers?.phone || "Sem telefone"}
                  </p>
                  <pre className="whitespace-pre-wrap text-sm bg-muted/50 rounded-md p-3 font-sans">{m.content}</pre>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => openWa(m)}>
                      <MessageCircle className="h-4 w-4 mr-2" /> Enviar no WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(m.content); toast.success("Mensagem copiada"); }}>
                      <Copy className="h-4 w-4 mr-2" /> Copiar
                    </Button>
                    {m.status !== "sent" && (
                      <Button size="sm" variant="ghost" onClick={() => setMsgStatus.mutate({ id: m.id, next: "sent" })}>
                        <Check className="h-4 w-4 mr-2" /> Marcar como enviada
                      </Button>
                    )}
                    {m.status !== "cancelled" && (
                      <Button size="sm" variant="ghost" onClick={() => setMsgStatus.mutate({ id: m.id, next: "cancelled" })}>
                        <X className="h-4 w-4 mr-2" /> Cancelar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Modelos por evento ---------------- */
function TemplatesManager({ companyId }: { companyId?: string }) {
  const qc = useQueryClient();
  const { data: templates } = useWaTemplates(companyId);
  const [event, setEvent] = useState<WaEvent>("appointment_confirmed");
  const [body, setBody] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const t = templates?.[event];
    setBody(t?.body ?? DEFAULT_TEMPLATES[event]);
    setEnabled(t?.enabled ?? true);
  }, [event, templates]);

  const save = useMutation({
    mutationFn: async () => {
      if (!companyId) return;
      const existing = templates?.[event];
      if (existing?.id) {
        const { error } = await supabase
          .from("whatsapp_templates").update({ body, enabled }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_templates").insert({ company_id: companyId, event, body, enabled });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Modelo salvo");
      qc.invalidateQueries({ queryKey: ["wa-templates", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const meta = WA_EVENTS.find((e) => e.id === event);
  const preview = renderWaTemplate(body, {
    nome_cliente: "João", nome_empresa: "Sua Empresa", servico: "Corte + Barba",
    profissional: "Ana", data: "12/08/2026", horario: "14:30", valor: "R$ 80,00",
    valor_sinal: "R$ 20,00", saldo_restante: "R$ 60,00", chave_pix: "pix@empresa.com",
    telefone_empresa: "(17) 99788-6655", endereco_empresa: "Rua Exemplo, 100",
    observacoes: "—", link_avaliacao: "https://seuapp.com/avaliacao/ABC123",
    link_confirmacao: "https://seuapp.com/confirmar/ABC123",
  });

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Eventos</CardTitle></CardHeader>
        <CardContent className="p-2 space-y-1">
          {WA_EVENTS.map((e) => (
            <button
              key={e.id}
              onClick={() => setEvent(e.id)}
              className={`w-full text-left text-sm rounded-md px-3 py-2 transition-colors ${
                event === e.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {e.emoji} {e.label}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{meta?.emoji} {meta?.label}</CardTitle>
          <CardDescription>{meta?.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Modelo ativo</Label>
              <p className="text-xs text-muted-foreground">Desativado, o evento não gera mensagem automática.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div>
            <Label>Mensagem</Label>
            <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} className="font-sans" />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Variáveis disponíveis (clique para inserir)</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {WA_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setBody((b) => `${b}{{${v}}}`)}
                  className="text-[11px] rounded-full border px-2 py-0.5 hover:bg-muted"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
            <pre className="whitespace-pre-wrap text-sm bg-muted/50 rounded-md p-3 font-sans mt-1.5">{preview}</pre>
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Salvar modelo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Envio rápido ---------------- */
function QuickSend({ companyId, companyName }: { companyId?: string; companyName: string }) {
  const qc = useQueryClient();
  const { data: templates } = useWaTemplates(companyId);
  const [event, setEvent] = useState<WaEvent>("custom");
  const [customerId, setCustomerId] = useState<string>("");
  const [manualPhone, setManualPhone] = useState("");
  const [message, setMessage] = useState<string>(DEFAULT_TEMPLATES.custom);

  const { data: customers = [] } = useQuery({
    queryKey: ["wa-customers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id,name,phone,whatsapp")
        .eq("company_id", companyId!)
        .order("name")
        .limit(500);
      return (data ?? []) as any[];
    },
  });

  const selected = useMemo(() => customers.find((c) => c.id === customerId) ?? null, [customers, customerId]);

  const applyEvent = (id: WaEvent) => {
    setEvent(id);
    setMessage(templates?.[id]?.body ?? DEFAULT_TEMPLATES[id]);
  };

  const finalMessage = renderWaTemplate(message, {
    nome_cliente: selected?.name ?? "cliente",
    nome_empresa: companyName,
  });

  const phone = selected?.whatsapp || selected?.phone || manualPhone;

  const send = async () => {
    if (!waDigits(phone)) { toast.error("Informe um telefone válido"); return; }
    if (!companyId) return;
    await sendWaLink({
      companyId, event, content: finalMessage, phone,
      customerId: selected?.id ?? null, queryClient: qc,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Envio rápido</CardTitle>
        <CardDescription>Escolha o modelo, o cliente e envie pelo link oficial do WhatsApp.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Modelo</Label>
            <Select value={event} onValueChange={(v) => applyEvent(v as WaEvent)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WA_EVENTS.map((e) => <SelectItem key={e.id} value={e.id}>{e.emoji} {e.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cliente</Label>
            <Select value={customerId || "none"} onValueChange={(v) => setCustomerId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Informar telefone manualmente</SelectItem>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!selected && (
          <div>
            <Label>Telefone</Label>
            <Input placeholder="(17) 99788-6655" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} />
          </div>
        )}

        <div>
          <Label>Mensagem</Label>
          <Textarea rows={8} value={message} onChange={(e) => setMessage(e.target.value)} />
          <p className="text-xs text-muted-foreground mt-1">
            Número final: {waDigits(phone) || "—"}
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={send}><Send className="h-4 w-4 mr-2" /> Enviar no WhatsApp</Button>
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(finalMessage); toast.success("Mensagem copiada"); }}>
            <Copy className="h-4 w-4 mr-2" /> Copiar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
