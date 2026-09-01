import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brl, dateBR, waLink, waNumber } from "@/lib/format";
import { toast } from "sonner";
import {
  CalendarCheck,
  ShieldAlert,
  Users,
  TrendingDown,
  Search,
  Plus,
  Trash2,
  MessageCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  ATTENDANCE_EVENTS,
  CLASSIFICATION,
  RISK_ACTIONS,
  WAITLIST_PERIODS,
  WAITLIST_STATUS,
  useAttendanceSettings,
  useSaveAttendanceSettings,
  useReliability,
  useAttendanceEvents,
  useWaitlist,
  type AttendanceSettings,
} from "@/lib/attendance";

export const Route = createFileRoute("/_authenticated/app/attendance")({
  component: Attendance,
  head: () => ({
    meta: [
      { title: "Controle de Comparecimento | Painel" },
      {
        name: "description",
        content: "Faltas, confiabilidade dos clientes e lista de espera do seu negócio.",
      },
    ],
  }),
});

function Attendance() {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id;

  const { data: settings } = useAttendanceSettings(companyId);
  const { data: rows = [], isLoading } = useReliability(companyId);
  const { data: events = [] } = useAttendanceEvents(companyId);

  const { data: customers = [] } = useQuery({
    enabled: !!companyId,
    queryKey: ["attendance-customers", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id,name,phone,whatsapp")
        .eq("company_id", companyId!);
      return data ?? [];
    },
  });
  const cmap = useMemo(() => new Map(customers.map((c: any) => [c.id, c])), [customers]);

  const metrics = useMemo(() => {
    const noShows = events.filter((e) => e.event === "no_show");
    const lateCancels = events.filter((e) => e.event === "late_cancel");
    const completed = events.filter((e) => e.event === "completed");
    const denom = completed.length + noShows.length;
    const lostCents = [...noShows, ...lateCancels].reduce((s, e) => s + (e.amount_cents ?? 0), 0);

    // Prejuízo evitado: valor dos atendimentos concluídos por clientes que já faltaram
    const riskIds = new Set(
      rows.filter((r) => r.classification !== "reliable").map((r) => r.customer_id),
    );
    const savedCents = completed
      .filter((e) => riskIds.has(e.customer_id))
      .reduce((s, e) => s + (e.amount_cents ?? 0), 0);

    return {
      rate: denom ? Math.round((completed.length * 1000) / denom) / 10 : 100,
      noShows: noShows.length,
      lateCancels: lateCancels.length,
      completed: completed.length,
      lostCents,
      savedCents,
      reliable: rows.filter((r) => r.classification === "reliable").length,
      attention: rows.filter((r) => r.classification === "attention").length,
      highRisk: rows.filter((r) => r.classification === "high_risk").length,
    };
  }, [events, rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <CalendarCheck className="h-5 w-5 text-primary" /> Controle de Comparecimento
        </h1>
        <p className="text-sm text-muted-foreground">
          Faltas, confiabilidade dos clientes, regras automáticas e lista de espera.
        </p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex w-full flex-wrap h-auto">
          <TabsTrigger value="dashboard">Visão geral</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="espera">Lista de espera</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
        </TabsList>

        {/* ---------------- Dashboard ---------------- */}
        <TabsContent value="dashboard" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Taxa de comparecimento"
              value={`${metrics.rate}%`}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <Stat
              label="Faltas registradas"
              value={String(metrics.noShows)}
              icon={<ShieldAlert className="h-4 w-4" />}
              tone="danger"
            />
            <Stat
              label="Prejuízo com faltas"
              value={brl(metrics.lostCents / 100)}
              icon={<TrendingDown className="h-4 w-4" />}
              tone="danger"
            />
            <Stat
              label="Prejuízo evitado"
              value={brl(metrics.savedCents / 100)}
              icon={<Users className="h-4 w-4" />}
              tone="success"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(["reliable", "attention", "high_risk"] as const).map((k) => {
              const meta = CLASSIFICATION[k];
              const count =
                k === "reliable"
                  ? metrics.reliable
                  : k === "attention"
                    ? metrics.attention
                    : metrics.highRisk;
              return (
                <Card key={k}>
                  <CardContent className="p-4">
                    <p className="text-sm font-medium">
                      {meta.emoji} {meta.label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold">{count}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo do período analisado</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
              <p>
                Atendimentos concluídos: <b>{metrics.completed}</b>
              </p>
              <p>
                Cancelamentos em cima da hora: <b>{metrics.lateCancels}</b>
              </p>
              <p>
                Janela considerada: <b>{settings?.lookback_days ?? 180} dias</b>
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Clientes ---------------- */}
        <TabsContent value="clientes" className="mt-4">
          <ClientsTab rows={rows} cmap={cmap} loading={isLoading} />
        </TabsContent>

        {/* ---------------- Histórico ---------------- */}
        <TabsContent value="historico" className="mt-4 space-y-2">
          {!events.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum registro ainda.
            </p>
          )}
          {events.slice(0, 200).map((e) => {
            const meta = ATTENDANCE_EVENTS[e.event] ?? { label: e.event, emoji: "•", tone: "" };
            const c: any = cmap.get(e.customer_id);
            return (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {meta.emoji} {c?.name ?? "Cliente"}
                  </p>
                  <p className={`text-xs ${meta.tone}`}>
                    {meta.label} · {dateBR(e.occurred_at)}
                    {e.hours_before != null && e.event !== "completed"
                      ? ` · ${Math.max(0, Math.round(Number(e.hours_before)))}h de antecedência`
                      : ""}
                  </p>
                </div>
                {e.amount_cents > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {brl(e.amount_cents / 100)}
                  </Badge>
                )}
              </div>
            );
          })}
        </TabsContent>

        {/* ---------------- Lista de espera ---------------- */}
        <TabsContent value="espera" className="mt-4">
          <WaitlistTab companyId={companyId} />
        </TabsContent>

        {/* ---------------- Regras ---------------- */}
        <TabsContent value="regras" className="mt-4">
          <SettingsTab companyId={companyId} settings={settings ?? null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: "danger" | "success";
}) {
  const color =
    tone === "danger"
      ? "text-destructive"
      : tone === "success"
        ? "text-emerald-600"
        : "text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={color}>{icon}</span>
          {label}
        </p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

/* ============================ Clientes ============================ */

function ClientsTab({
  rows,
  cmap,
  loading,
}: {
  rows: any[];
  cmap: Map<string, any>;
  loading: boolean;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("todos");

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows
      .filter((r) => (filter === "todos" ? true : r.classification === filter))
      .filter((r) => {
        if (!term) return true;
        const c = cmap.get(r.customer_id);
        return (c?.name ?? "").toLowerCase().includes(term);
      })
      .sort((a, b) => a.score - b.score);
  }, [rows, q, filter, cmap]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente…"
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as classificações</SelectItem>
            <SelectItem value="reliable">🟢 Confiável</SelectItem>
            <SelectItem value="attention">🟡 Atenção</SelectItem>
            <SelectItem value="high_risk">🔴 Alto risco</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>}
      {!loading && !list.length && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum cliente com histórico de comparecimento ainda.
        </p>
      )}

      <div className="space-y-2">
        {list.map((r) => {
          const c: any = cmap.get(r.customer_id);
          const meta = CLASSIFICATION[r.classification] ?? CLASSIFICATION.reliable;
          return (
            <Card key={r.customer_id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{c?.name ?? "Cliente"}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.completed} presenças · {r.no_shows} faltas · {r.late_cancels} cancelamentos
                      em cima da hora
                    </p>
                  </div>
                  <Badge variant="outline" className={meta.badge}>
                    {meta.emoji} {meta.label}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[11px] text-muted-foreground">
                      Confiabilidade: {r.score}/100
                    </p>
                    <Progress value={r.score} className="h-2" />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] text-muted-foreground">
                      Taxa de comparecimento: {r.attendance_rate}%
                    </p>
                    <Progress value={Number(r.attendance_rate)} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ Lista de espera ============================ */

function WaitlistTab({ companyId }: { companyId?: string }) {
  const qc = useQueryClient();
  const { data: entries = [] } = useWaitlist(companyId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    service_id: "",
    preferred_date: "",
    preferred_period: "any",
    notes: "",
  });

  const { data: services = [] } = useQuery({
    enabled: !!companyId,
    queryKey: ["waitlist-services", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id,name")
        .eq("company_id", companyId!)
        .eq("active", true);
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.customer_name.trim()) throw new Error("Informe o nome do cliente.");
      const { error } = await supabase.from("waitlist_entries").insert({
        company_id: companyId!,
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim() || null,
        service_id: form.service_id || null,
        preferred_date: form.preferred_date || null,
        preferred_period: form.preferred_period,
        notes: form.notes.trim() || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente adicionado à lista de espera.");
      setForm({
        customer_name: "",
        phone: "",
        service_id: "",
        preferred_date: "",
        preferred_period: "any",
        notes: "",
      });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["waitlist", companyId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível adicionar."),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("waitlist_entries")
        .update({
          status,
          notified_at: status === "notified" ? new Date().toISOString() : null,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["waitlist", companyId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("waitlist_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["waitlist", companyId] }),
  });

  const waUrl = (e: any) => {
    const phone = waNumber(e.phone);
    if (!phone) return null;
    const msg = `Oi ${e.customer_name}! 👋 Abriu um horário aqui na agenda${e.services?.name ? ` para *${e.services.name}*` : ""}. Quer garantir? 😊`;
    return waLink(phone, msg);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Quando um horário é cancelado, você recebe um aviso com os clientes da fila.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo cliente na lista de espera</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <Label>Serviço desejado</Label>
                <Select
                  value={form.service_id || "none"}
                  onValueChange={(v) => setForm({ ...form, service_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Qualquer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Qualquer serviço</SelectItem>
                    {services.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data preferida</Label>
                  <Input
                    type="date"
                    value={form.preferred_date}
                    onChange={(e) => setForm({ ...form, preferred_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Período</Label>
                  <Select
                    value={form.preferred_period}
                    onValueChange={(v) => setForm({ ...form, preferred_period: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(WAITLIST_PERIODS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!entries.length && (
        <p className="py-10 text-center text-sm text-muted-foreground">Lista de espera vazia.</p>
      )}

      <div className="space-y-2">
        {entries.map((e: any) => (
          <div
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium">{e.customer_name}</p>
              <p className="text-xs text-muted-foreground">
                {e.services?.name ?? "Qualquer serviço"} · {WAITLIST_PERIODS[e.preferred_period]}
                {e.preferred_date ? ` · ${dateBR(e.preferred_date)}` : ""}
                {e.phone ? ` · ${e.phone}` : ""}
              </p>
              {e.notes && <p className="mt-1 text-xs italic text-muted-foreground">"{e.notes}"</p>}
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {WAITLIST_STATUS[e.status]}
              </Badge>
              {waUrl(e) && (
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={waUrl(e)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setStatus.mutate({ id: e.id, status: "notified" })}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {e.status !== "converted" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus.mutate({ id: e.id, status: "converted" })}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(e.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ Regras ============================ */

function SettingsTab({
  companyId,
  settings,
}: {
  companyId?: string;
  settings: AttendanceSettings | null;
}) {
  const save = useSaveAttendanceSettings(companyId);
  const [f, setF] = useState<Partial<AttendanceSettings>>({});
  const [reminders, setReminders] = useState("24, 3");

  useEffect(() => {
    if (settings) {
      setF(settings);
      setReminders((settings.reminder_offsets_hours ?? [24, 3]).join(", "));
    }
  }, [settings]);

  const v = (k: keyof AttendanceSettings, d: any) => (f as any)[k] ?? d;

  const submit = () => {
    const offsets = reminders
      .split(",")
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0 && n <= 720);
    save.mutate({ ...f, reminder_offsets_hours: offsets.length ? offsets : [24, 3] } as any, {
      onSuccess: () => toast.success("Regras salvas."),
      onError: (e: any) => toast.error(e.message ?? "Erro ao salvar."),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cálculo da confiabilidade</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Num
            label="Período analisado (dias)"
            value={v("lookback_days", 180)}
            onChange={(n) => setF({ ...f, lookback_days: n })}
          />
          <Num
            label="Cancelamento é 'em cima da hora' abaixo de (horas)"
            value={v("late_cancel_hours", 24)}
            onChange={(n) => setF({ ...f, late_cancel_hours: n })}
          />
          <Num
            label="Pontos por presença"
            value={v("weight_completed", 4)}
            onChange={(n) => setF({ ...f, weight_completed: n })}
          />
          <Num
            label="Pontos por falta"
            value={v("weight_no_show", -25)}
            onChange={(n) => setF({ ...f, weight_no_show: n })}
          />
          <Num
            label="Pontos por cancelamento em cima da hora"
            value={v("weight_late_cancel", -12)}
            onChange={(n) => setF({ ...f, weight_late_cancel: n })}
          />
          <Num
            label="Pontos por cancelamento com antecedência"
            value={v("weight_cancel", -4)}
            onChange={(n) => setF({ ...f, weight_cancel: n })}
          />
          <Num
            label="Abaixo desta pontuação = Atenção"
            value={v("attention_score", 70)}
            onChange={(n) => setF({ ...f, attention_score: n })}
          />
          <Num
            label="Abaixo desta pontuação = Alto risco"
            value={v("risk_score", 40)}
            onChange={(n) => setF({ ...f, risk_score: n })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regra para clientes com muitas faltas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Num
            label="Faltas necessárias para aplicar a regra"
            value={v("min_no_shows_for_action", 2)}
            onChange={(n) => setF({ ...f, min_no_shows_for_action: n })}
          />
          <div>
            <Label>O que fazer</Label>
            <Select
              value={v("risk_action", "require_confirmation")}
              onValueChange={(val) => setF({ ...f, risk_action: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RISK_ACTIONS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Aplicado automaticamente no agendamento online do cliente.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lembretes e lista de espera</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Lembretes antes do atendimento (horas)
            </Label>
            <Input
              value={reminders}
              onChange={(e) => setReminders(e.target.value)}
              placeholder="24, 3"
            />
            <p className="mt-1 text-xs text-muted-foreground">Separe por vírgula. Ex.: 48, 24, 3</p>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Lista de espera automática</p>
              <p className="text-xs text-muted-foreground">
                Avisar quando um horário for liberado.
              </p>
            </div>
            <Switch
              checked={v("waitlist_enabled", true)}
              onCheckedChange={(c) => setF({ ...f, waitlist_enabled: c })}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={submit} disabled={save.isPending}>
        Salvar regras
      </Button>
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value || "0", 10))}
      />
    </div>
  );
}
