import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { useAuth } from "@/lib/auth";
import { saoPauloDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  CONFIRMATION_STATUS,
  DEFAULT_CONFIRMATION_TEMPLATE,
  RESEND_COOLDOWN_MIN,
  CHANNELS,
} from "@/lib/messaging";
import {
  CalendarCheck,
  Send,
  MessageCircle,
  RefreshCw,
  Percent,
  Clock,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/confirmations")({
  component: Confirmations,
});

type Conf = {
  id: string;
  appointment_id: string;
  company_id: string;
  token: string;
  channel: string;
  status: string;
  message: string | null;
  send_url: string | null;
  sent_at: string | null;
  last_sent_at: string | null;
  send_attempts: number;
  responded_at: string | null;
  response: string | null;
  cancel_reason: string | null;
  expires_at: string;
  created_at: string;
  appointments: {
    starts_at: string;
    status: string;
    customers: { name: string | null; phone: string | null } | null;
  } | null;
};

function Confirmations() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const companyId = activeCompany!.id;

  const { data: confs = [], isLoading } = useQuery({
    queryKey: ["confirmations", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_confirmations")
        .select("*, appointments(starts_at, status, customers(name, phone))")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as Conf[];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["messaging-logs", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messaging_logs")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as any[];
    },
  });

  const kpis = useMemo(() => {
    const today = saoPauloDate();
    const month = today.slice(0, 7);
    const awaiting = confs.filter((c) => ["pending", "sent"].includes(c.status)).length;
    const confirmed = confs.filter((c) => c.status === "confirmed").length;
    const cancelled = confs.filter((c) => c.status === "cancelled").length;
    const noReply = confs.filter((c) => c.status === "expired").length;
    const sentToday = confs.filter((c) => (c.sent_at ?? "").slice(0, 10) === today).length;
    const sentMonth = confs.filter((c) => (c.sent_at ?? "").slice(0, 7) === month).length;
    const answered = confirmed + cancelled;
    const rate = confs.length ? Math.round((confirmed / confs.length) * 100) : 0;
    return { awaiting, confirmed, cancelled, noReply, sentToday, sentMonth, rate, answered };
  }, [confs]);

  const resend = useMutation({
    mutationFn: async (c: Conf) => {
      const last = c.last_sent_at ? new Date(c.last_sent_at).getTime() : 0;
      const diffMin = (Date.now() - last) / 60000;
      if (last && diffMin < RESEND_COOLDOWN_MIN) {
        throw new Error(`Aguarde ${Math.ceil(RESEND_COOLDOWN_MIN - diffMin)} min para reenviar`);
      }
      const { error } = await supabase
        .from("appointment_confirmations")
        .update({
          status: "sent",
          last_sent_at: new Date().toISOString(),
          send_attempts: (c.send_attempts ?? 0) + 1,
        } as any)
        .eq("id", c.id);
      if (error) throw error;
      await supabase.from("messaging_logs").insert({
        company_id: companyId,
        appointment_id: c.appointment_id,
        confirmation_id: c.id,
        channel: c.channel,
        event: "resent",
        status: "sent",
        detail: "Reenvio manual",
        actor_user_id: user?.id ?? null,
      } as any);
      if (c.send_url) window.open(c.send_url, "_blank", "noopener");
    },
    onSuccess: () => {
      toast.success("Confirmação reenviada");
      qc.invalidateQueries({ queryKey: ["confirmations", companyId] });
      qc.invalidateQueries({ queryKey: ["messaging-logs", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Confirmações</h1>
        <p className="text-sm text-muted-foreground">
          Lembretes automáticos antes do horário, com link único de confirmação.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Aguardando confirmação"
          value={String(kpis.awaiting)}
          icon={<Clock className="h-4 w-4" />}
        />
        <Kpi
          label="Confirmados"
          value={String(kpis.confirmed)}
          icon={<CalendarCheck className="h-4 w-4" />}
        />
        <Kpi
          label="Cancelados"
          value={String(kpis.cancelled)}
          icon={<XCircle className="h-4 w-4" />}
        />
        <Kpi
          label="Não respondidos"
          value={String(kpis.noReply)}
          icon={<Clock className="h-4 w-4" />}
        />
        <Kpi
          label="Taxa de confirmação"
          value={`${kpis.rate}%`}
          icon={<Percent className="h-4 w-4" />}
        />
        <Kpi
          label="Lembretes hoje"
          value={String(kpis.sentToday)}
          icon={<Send className="h-4 w-4" />}
        />
        <Kpi
          label="Lembretes no mês"
          value={String(kpis.sentMonth)}
          icon={<Send className="h-4 w-4" />}
        />
        <Kpi
          label="Respostas"
          value={String(kpis.answered)}
          icon={<MessageCircle className="h-4 w-4" />}
        />
      </div>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="settings">Integrações</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? (
                <p className="p-12 text-center text-muted-foreground">Carregando…</p>
              ) : !confs.length ? (
                <div className="p-12 text-center">
                  <CalendarCheck className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhuma confirmação gerada ainda. O sistema cria automaticamente 24h antes de
                    cada agendamento.
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left">
                    <tr>
                      <th className="p-3 font-medium">Cliente</th>
                      <th className="p-3 font-medium">Data / hora</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium">Canal</th>
                      <th className="p-3 font-medium">Envio</th>
                      <th className="p-3 font-medium">Resposta</th>
                      <th className="p-3 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confs.map((c) => {
                      const when = c.appointments?.starts_at
                        ? new Date(c.appointments.starts_at)
                        : null;
                      return (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="p-3">
                            <p className="font-medium">{c.appointments?.customers?.name ?? "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.appointments?.customers?.phone ?? ""}
                            </p>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {when
                              ? `${when.toLocaleDateString("pt-BR")} ${when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                              : "—"}
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${CONFIRMATION_STATUS[c.status]?.color ?? ""}`}
                            >
                              {CONFIRMATION_STATUS[c.status]?.label ?? c.status}
                            </span>
                          </td>
                          <td className="p-3">{c.channel}</td>
                          <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                            {c.last_sent_at
                              ? new Date(c.last_sent_at).toLocaleString("pt-BR")
                              : "—"}
                            {c.send_attempts > 1 && ` (${c.send_attempts}x)`}
                          </td>
                          <td className="p-3 text-xs">
                            {c.responded_at ? (
                              <>
                                {c.response === "confirm" ? "Confirmou" : "Cancelou"} ·{" "}
                                {new Date(c.responded_at).toLocaleString("pt-BR")}
                                {c.cancel_reason && (
                                  <p className="text-muted-foreground">{c.cancel_reason}</p>
                                )}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-1">
                              {c.send_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(c.send_url!, "_blank", "noopener")}
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              )}
                              {!c.responded_at && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Reenviar confirmação"
                                  onClick={() => resend.mutate(c)}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {!logs.length ? (
                <p className="p-12 text-center text-sm text-muted-foreground">
                  Nenhum log registrado ainda.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left">
                    <tr>
                      <th className="p-3 font-medium">Data</th>
                      <th className="p-3 font-medium">Evento</th>
                      <th className="p-3 font-medium">Canal</th>
                      <th className="p-3 font-medium">Detalhe</th>
                      <th className="p-3 font-medium">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="p-3 whitespace-nowrap">
                          {new Date(l.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-3">{l.event}</td>
                        <td className="p-3">{l.channel ?? "—"}</td>
                        <td className="p-3 text-muted-foreground">{l.detail ?? "—"}</td>
                        <td className="p-3 text-xs text-muted-foreground">{l.ip ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <MessagingSettings companyId={companyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MessagingSettings({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["messaging-settings", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messaging_settings")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      return (data ?? null) as any;
    },
  });

  const [f, setF] = useState<any>({
    auto_confirmation_enabled: true,
    reminder_hours: 24,
    active_channels: ["whatsapp"],
    message_template: DEFAULT_CONFIRMATION_TEMPLATE,
  });

  useEffect(() => {
    if (data)
      setF({ ...data, message_template: data.message_template ?? DEFAULT_CONFIRMATION_TEMPLATE });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...f, company_id: companyId };
      delete payload.created_at;
      delete payload.updated_at;
      const { error } = await supabase
        .from("messaging_settings")
        .upsert(payload, { onConflict: "company_id" } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["messaging-settings", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleChannel = (id: string, on: boolean) => {
    const cur: string[] = f.active_channels ?? [];
    setF({
      ...f,
      active_channels: on ? Array.from(new Set([...cur, id])) : cur.filter((c) => c !== id),
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="font-medium">Geração automática de lembretes</h2>
          <div className="flex items-center justify-between">
            <Label>Gerar lembretes automaticamente</Label>
            <Switch
              checked={!!f.auto_confirmation_enabled}
              onCheckedChange={(v) => setF({ ...f, auto_confirmation_enabled: v })}
            />
          </div>
          <div>
            <Label>Antecedência (horas)</Label>
            <Input
              type="number"
              min={1}
              value={f.reminder_hours ?? 24}
              onChange={(e) => setF({ ...f, reminder_hours: parseInt(e.target.value || "24", 10) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Canais ativos</Label>
            {CHANNELS.map((ch) => (
              <div key={ch.id} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">
                  {ch.icon} {ch.label}
                </span>
                <Switch
                  checked={(f.active_channels ?? []).includes(ch.id)}
                  onCheckedChange={(v) => toggleChannel(ch.id, v)}
                />
              </div>
            ))}
          </div>
          <div>
            <Label>Modelo da mensagem</Label>
            <Textarea
              rows={12}
              value={f.message_template ?? ""}
              onChange={(e) => setF({ ...f, message_template: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Variáveis:{" "}
              {
                "{{NomeCliente}} {{Data}} {{Hora}} {{Servico}} {{Funcionario}} {{LinkConfirmacao}} {{Empresa}}"
              }
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <h2 className="font-medium">Método de envio</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              O sistema gera o lembrete e abre o WhatsApp com o número e a mensagem preenchidos. O
              envio final é sempre confirmado manualmente no WhatsApp.
            </p>
          </div>
          <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
            Salvar configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          {icon}
          {label}
        </div>
        <p className="mt-1 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
