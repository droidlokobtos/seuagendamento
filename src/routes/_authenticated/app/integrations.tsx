import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import {
  connectWhatsApp,
  disconnectWhatsApp,
  processWhatsAppQueue,
} from "@/lib/whatsapp.functions";
import {
  DEFAULT_TEMPLATES,
  REMINDER_OFFSET_OPTIONS,
  WA_EVENTS,
  WA_MESSAGE_STATUS,
  WA_PROVIDERS,
  WA_STATUS,
  WA_VARIABLES,
  type WaEvent,
} from "@/lib/whatsapp";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  MessageCircle,
  Plug,
  PlugZap,
  QrCode,
  RefreshCw,
  Save,
  Send,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/integrations")({
  component: IntegrationsPage,
  head: () => ({
    meta: [
      { title: "Integrações de WhatsApp | Painel da empresa" },
      {
        name: "description",
        content:
          "Conecte o WhatsApp da sua empresa, personalize os modelos de mensagem automática e acompanhe o histórico de envios.",
      },
      { property: "og:title", content: "Integrações de WhatsApp" },
      {
        property: "og:description",
        content: "Conexão, modelos de mensagem e histórico de envios do WhatsApp da sua empresa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

function IntegrationsPage() {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrações · WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Conecte o número da sua empresa, personalize as mensagens automáticas e acompanhe os envios.
        </p>
      </div>

      {!companyId ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Selecione uma empresa para configurar a integração.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="conexao">
          <TabsList>
            <TabsTrigger value="conexao">Conexão</TabsTrigger>
            <TabsTrigger value="modelos">Modelos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="conexao" className="mt-4">
            <ConnectionTab companyId={companyId} />
          </TabsContent>
          <TabsContent value="modelos" className="mt-4">
            <TemplatesTab companyId={companyId} />
          </TabsContent>
          <TabsContent value="historico" className="mt-4">
            <HistoryTab companyId={companyId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/* ------------------------------- Conexão -------------------------------- */

function ConnectionTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const connect = useServerFn(connectWhatsApp);
  const disconnect = useServerFn(disconnectWhatsApp);
  const processQueue = useServerFn(processWhatsAppQueue);

  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [form, setForm] = useState({
    provider: "manual",
    api_url: "",
    api_token: "",
    auto_send_enabled: true,
    max_attempts: 3,
    offsets: [24, 1] as number[],
  });

  const { data: integration, isLoading } = useQuery({
    queryKey: ["wa-integration", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_integrations")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (data) return data;
      const { data: created } = await supabase
        .from("whatsapp_integrations")
        .insert({ company_id: companyId })
        .select("*")
        .maybeSingle();
      return created;
    },
  });

  useEffect(() => {
    if (!integration) return;
    setForm({
      provider: integration.provider ?? "manual",
      api_url: integration.api_url ?? "",
      api_token: integration.api_token ?? "",
      auto_send_enabled: integration.auto_send_enabled ?? true,
      max_attempts: integration.max_attempts ?? 3,
      offsets: integration.reminder_offsets_hours ?? [24, 1],
    });
  }, [integration]);

  const status = integration?.status ?? "disconnected";
  const badge = WA_STATUS[status] ?? WA_STATUS.disconnected;
  const providerMeta = WA_PROVIDERS.find((p) => p.id === form.provider);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("whatsapp_integrations")
      .update({
        provider: form.provider,
        api_url: form.api_url || null,
        api_token: form.api_token || null,
        auto_send_enabled: form.auto_send_enabled,
        max_attempts: form.max_attempts,
        reminder_offsets_hours: form.offsets,
      })
      .eq("company_id", companyId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
    qc.invalidateQueries({ queryKey: ["wa-integration", companyId] });
  };

  const doConnect = async () => {
    setBusy(true);
    try {
      const res: any = await connect({ data: { companyId } });
      setQr(res?.qr ?? null);
      if (res?.status === "connected") toast.success("WhatsApp conectado");
      else if (res?.status === "pending_qr") toast.info("Leia o QR Code no seu WhatsApp");
      else toast.error(res?.message ?? "Falha ao conectar");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao conectar");
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["wa-integration", companyId] });
    }
  };

  const doDisconnect = async () => {
    setBusy(true);
    try {
      await disconnect({ data: { companyId } });
      setQr(null);
      toast.success("WhatsApp desconectado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao desconectar");
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["wa-integration", companyId] });
    }
  };

  const doProcess = async () => {
    setBusy(true);
    try {
      const res: any = await processQueue({ data: { companyId } });
      toast.success(`${res?.processed ?? 0} mensagens reprocessadas`);
      qc.invalidateQueries({ queryKey: ["wa-messages", companyId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao processar fila");
    } finally {
      setBusy(false);
    }
  };

  const toggleOffset = (h: number) =>
    setForm((f) => ({
      ...f,
      offsets: f.offsets.includes(h) ? f.offsets.filter((x) => x !== h) : [...f.offsets, h].sort((a, b) => b - a),
    }));

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" /> Status da conexão
            </CardTitle>
            <Badge variant="outline" className={badge.className}>
              {badge.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <Info label="Dispositivo conectado" value={integration?.device_name ?? "—"} />
            <Info label="Número" value={integration?.phone_number ?? "—"} />
            <Info label="Última sincronização" value={fmt(integration?.last_sync_at)} />
            <Info label="Última atividade" value={fmt(integration?.last_activity_at)} />
            <Info label="Conectado desde" value={fmt(integration?.connected_at)} />
            <Info label="Provedor" value={providerMeta?.label ?? form.provider} />
          </div>

          {integration?.last_error && (
            <p className="text-sm text-destructive">{integration.last_error}</p>
          )}

          {status !== "connected" && (
            <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
              <QrCode className="h-8 w-8 mx-auto text-muted-foreground" />
              {qr ? (
                <img src={qr} alt="QR Code do WhatsApp Web" className="mx-auto h-48 w-48" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {form.provider === "manual"
                    ? "No modo manual não há QR Code: as mensagens ficam prontas na fila para envio em 1 clique pelo WhatsApp Web."
                    : "Clique em “Conectar WhatsApp” para gerar o QR Code da sessão."}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {status === "connected" ? (
              <Button variant="outline" onClick={doDisconnect} disabled={busy}>
                <PlugZap className="h-4 w-4 mr-2" /> Desconectar WhatsApp
              </Button>
            ) : (
              <Button onClick={doConnect} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}
                Conectar WhatsApp
              </Button>
            )}
            <Button variant="outline" onClick={doProcess} disabled={busy}>
              <RefreshCw className="h-4 w-4 mr-2" /> Processar fila
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Provedor de envio</CardTitle>
          <CardDescription>
            A camada de mensageria é modular: trocar de provedor não altera nenhuma regra do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Provedor</Label>
              <Select value={form.provider} onValueChange={(v) => setForm((f) => ({ ...f, provider: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WA_PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{providerMeta?.hint}</p>
            </div>
            <div>
              <Label>Máximo de tentativas de reenvio</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={form.max_attempts}
                onChange={(e) => setForm((f) => ({ ...f, max_attempts: Number(e.target.value) || 1 }))}
              />
            </div>
          </div>

          {form.provider !== "manual" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>URL do serviço</Label>
                <Input
                  value={form.api_url}
                  onChange={(e) => setForm((f) => ({ ...f, api_url: e.target.value }))}
                  placeholder="https://meu-bridge.exemplo.com"
                />
              </div>
              <div>
                <Label>Token de acesso</Label>
                <Input
                  type="password"
                  value={form.api_token}
                  onChange={(e) => setForm((f) => ({ ...f, api_token: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Envio automático</Label>
              <p className="text-xs text-muted-foreground">
                Gera as mensagens dos eventos do sistema automaticamente.
              </p>
            </div>
            <Switch
              checked={form.auto_send_enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, auto_send_enabled: v }))}
            />
          </div>

          <div>
            <Label>Lembretes automáticos</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {REMINDER_OFFSET_OPTIONS.map((o) => (
                <Button
                  key={o.hours}
                  type="button"
                  size="sm"
                  variant={form.offsets.includes(o.hours) ? "default" : "outline"}
                  onClick={() => toggleOffset(o.hours)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </div>

          <Button onClick={save} disabled={busy}>
            <Save className="h-4 w-4 mr-2" /> Salvar configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  );
}

/* ------------------------------- Modelos -------------------------------- */

function TemplatesTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, { body: string; enabled: boolean }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["wa-templates", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_templates")
        .select("event, body, enabled")
        .eq("company_id", companyId);
      return data ?? [];
    },
  });

  const byEvent = useMemo(() => {
    const map: Record<string, { body: string; enabled: boolean }> = {};
    for (const e of WA_EVENTS) map[e.id] = { body: DEFAULT_TEMPLATES[e.id], enabled: true };
    for (const r of rows as any[]) map[r.event] = { body: r.body, enabled: r.enabled };
    return map;
  }, [rows]);

  const value = (event: WaEvent) => drafts[event] ?? byEvent[event];

  const save = async (event: WaEvent) => {
    const v = value(event);
    setSaving(event);
    const { error } = await supabase
      .from("whatsapp_templates")
      .upsert(
        { company_id: companyId, event, body: v.body, enabled: v.enabled },
        { onConflict: "company_id,event" },
      );
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success("Modelo salvo");
    qc.invalidateQueries({ queryKey: ["wa-templates", companyId] });
  };

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Variáveis disponíveis</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {WA_VARIABLES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(`{{${v}}}`);
                toast.success(`{{${v}}} copiado`);
              }}
              className="rounded-md border bg-muted/50 px-2 py-1 text-xs font-mono hover:bg-muted"
            >
              {`{{${v}}}`}
            </button>
          ))}
        </CardContent>
      </Card>

      {WA_EVENTS.map((e) => {
        const v = value(e.id);
        return (
          <Card key={e.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{e.label}</CardTitle>
                  <CardDescription>{e.description}</CardDescription>
                </div>
                <Switch
                  checked={v.enabled}
                  onCheckedChange={(checked) =>
                    setDrafts((d) => ({ ...d, [e.id]: { ...v, enabled: checked } }))
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={8}
                value={v.body}
                onChange={(ev) => setDrafts((d) => ({ ...d, [e.id]: { ...v, body: ev.target.value } }))}
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => save(e.id)} disabled={saving === e.id}>
                  {saving === e.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setDrafts((d) => ({ ...d, [e.id]: { body: DEFAULT_TEMPLATES[e.id], enabled: v.enabled } }))
                  }
                >
                  Restaurar padrão
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------ Histórico ------------------------------- */

function HistoryTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["wa-messages", companyId, status],
    refetchInterval: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "all") q = q.eq("status", status);
      const { data } = await q;
      return data ?? [];
    },
  });

  const mark = async (id: string, next: string) => {
    await supabase
      .from("whatsapp_messages")
      .update({ status: next, sent_at: next === "sent" ? new Date().toISOString() : null })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["wa-messages", companyId] });
  };

  const label = (event: string) => WA_EVENTS.find((e) => e.id === event)?.label ?? event;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(WA_MESSAGE_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !rows.length ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-3 opacity-40" />
            Nenhuma mensagem registrada ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((m: any) => {
            const st = WA_MESSAGE_STATUS[m.status] ?? WA_MESSAGE_STATUS.pending;
            return (
              <Card key={m.id}>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0 gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{label(m.event)}</Badge>
                    <Badge variant="outline" className={st.className}>
                      {st.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{m.to_phone ?? "sem telefone"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{fmt(m.created_at)}</span>
                </CardHeader>
                <CardContent className="space-y-3">
                  <pre className="whitespace-pre-wrap text-sm bg-muted/50 rounded-md p-3 font-sans">
                    {m.content}
                  </pre>
                  <p className="text-xs text-muted-foreground">
                    Tentativas: {m.attempts}/{m.max_attempts}
                    {m.error ? ` · Falha: ${m.error}` : ""}
                    {m.sent_at ? ` · Enviada em ${fmt(m.sent_at)}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {m.wa_url && (
                      <Button
                        size="sm"
                        onClick={() => {
                          window.open(m.wa_url, "_blank", "noopener");
                          void mark(m.id, "sent");
                        }}
                      >
                        <Send className="h-4 w-4 mr-2" /> Enviar no WhatsApp
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(m.content);
                        toast.success("Mensagem copiada");
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" /> Copiar
                    </Button>
                    {m.status !== "cancelled" && m.status !== "sent" && (
                      <Button size="sm" variant="ghost" onClick={() => mark(m.id, "cancelled")}>
                        Cancelar envio
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
