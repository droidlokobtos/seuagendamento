import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { useIsCompanyAdmin } from "@/components/app/AnamnesisTab";
import { toast } from "sonner";
import { brl, dateBR } from "@/lib/format";
import {
  PLAN_KINDS, PLAN_STATUS, PAYMENT_METHODS, planDashboard, effectivePrice,
  isExpiredPlan, daysUntil, logPlanAudit, usePlans, useCustomerPlans, usePlanAudit, usePlanUsage,
  type PlanKind,
} from "@/lib/plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  Package, Plus, Pencil, Trash2, Search, CalendarClock, Ban, Copy, RefreshCw,
  PlusCircle, History, ShieldCheck, TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/plans")({
  component: PlansPage,
});

const centsToInput = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
const inputToCents = (v: string) => {
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

type PlanServiceDraft = { service_id: string; sessions: number; notes: string };

/* ================= Página ================= */

function PlansPage() {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? "";
  const isAdmin = useIsCompanyAdmin(companyId);

  const { data: plans = [], isLoading } = usePlans(companyId);
  const { data: sales = [] } = useCustomerPlans(companyId);

  const { data: usedToday = 0 } = useQuery({
    enabled: !!companyId,
    queryKey: ["plan-usage-today", companyId],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("plan_session_usage")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("used_at", start.toISOString());
      return count ?? 0;
    },
  });

  const kpi = useMemo(() => planDashboard(sales), [sales]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Planos e Pacotes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Crie planos e pacotes, venda para clientes e acompanhe o consumo das sessões.
          </p>
        </div>
      </div>

      {/* Dashboard */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Package} label="Planos vendidos" value={kpi.plansSold} />
        <Kpi icon={Package} label="Pacotes vendidos" value={kpi.packagesSold} />
        <Kpi icon={TrendingUp} label="Receita gerada" value={brl(kpi.revenue / 100)} tone="success" />
        <Kpi icon={ShieldCheck} label="Planos ativos" value={kpi.activePlans} tone="success" />
        <Kpi icon={ShieldCheck} label="Pacotes ativos" value={kpi.activePackages} tone="success" />
        <Kpi icon={History} label="Sessões usadas hoje" value={usedToday} />
        <Kpi icon={CalendarClock} label="Sessões restantes" value={kpi.remaining} />
        <Kpi icon={CalendarClock} label="Vencendo em 7 dias" value={kpi.expiringSoon} tone="warning" />
        <Kpi icon={Ban} label="Vencidos" value={kpi.expired} tone="danger" />
      </div>

      <Tabs defaultValue="catalogo">
        <TabsList className="flex w-full flex-wrap h-auto">
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="mt-4">
          <CatalogTab companyId={companyId} isAdmin={isAdmin} plans={plans} loading={isLoading} />
        </TabsContent>
        <TabsContent value="vendas" className="mt-4">
          <SalesTab companyId={companyId} isAdmin={isAdmin} plans={plans} sales={sales} />
        </TabsContent>
        <TabsContent value="auditoria" className="mt-4">
          <AuditTab companyId={companyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneMap = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  } as const;
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-semibold truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ================= Catálogo ================= */

function CatalogTab({
  companyId, isAdmin, plans, loading,
}: { companyId: string; isAdmin: boolean; plans: any[]; loading: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = plans.filter((p) =>
    [p.name, p.description, PLAN_KINDS[p.kind as PlanKind]].join(" ").toLowerCase().includes(search.toLowerCase()),
  );

  const remove = useMutation({
    mutationFn: async (plan: any) => {
      const { error } = await supabase.from("plans").delete().eq("id", plan.id);
      if (error) throw error;
      await logPlanAudit({
        company_id: companyId, entity: "plan", entity_id: plan.id,
        action: "deleted", description: `Plano/pacote excluído: ${plan.name}`, old_data: plan,
      });
    },
    onSuccess: () => {
      toast.success("Plano excluído.");
      void qc.invalidateQueries({ queryKey: ["plans", companyId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível excluir."),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar plano ou pacote…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhum plano ou pacote cadastrado.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              {p.image_url && <img src={p.image_url} alt="" className="h-32 w-full object-cover" loading="lazy" />}
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{PLAN_KINDS[p.kind as PlanKind]}</p>
                  </div>
                  <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                </div>
                {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold">{brl(effectivePrice(p) / 100)}</span>
                  {p.promo_price_cents ? (
                    <span className="text-xs line-through text-muted-foreground">{brl(p.price_cents / 100)}</span>
                  ) : null}
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {(p.plan_services ?? []).map((s: any) => (
                    <li key={s.id}>• {s.services?.name ?? "Serviço"} ({s.sessions})</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-1 pt-1 text-[11px] text-muted-foreground">
                  {p.duration_days ? <span className="rounded bg-muted px-2 py-0.5">{p.duration_days} dias</span> : null}
                  {p.valid_until ? <span className="rounded bg-muted px-2 py-0.5">até {dateBR(p.valid_until)}</span> : null}
                  <span className="rounded bg-muted px-2 py-0.5">
                    {p.waive_deposit ? "Isenta sinal" : "Cobra sinal"}
                  </span>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditing(p); setOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => { if (confirm(`Excluir "${p.name}"?`)) remove.mutate(p); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <Dialog open={open} onOpenChange={setOpen}>
          <PlanDialog companyId={companyId} plan={editing} onDone={() => setOpen(false)} />
        </Dialog>
      )}
    </div>
  );
}

function PlanDialog({ companyId, plan, onDone }: { companyId: string; plan: any | null; onDone: () => void }) {
  const qc = useQueryClient();
  const { data: services = [] } = useQuery({
    enabled: !!companyId,
    queryKey: ["plan-services-options", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("services").select("id,name,price_cents").eq("company_id", companyId).eq("active", true).order("name");
      return data ?? [];
    },
  });

  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [kind, setKind] = useState<PlanKind>((plan?.kind as PlanKind) ?? "package");
  const [price, setPrice] = useState(centsToInput(plan?.price_cents ?? 0));
  const [promo, setPromo] = useState(centsToInput(plan?.promo_price_cents));
  const [validUntil, setValidUntil] = useState(plan?.valid_until ?? "");
  const [sessionsTotal, setSessionsTotal] = useState(plan?.sessions_total?.toString() ?? "");
  const [durationDays, setDurationDays] = useState(plan?.duration_days?.toString() ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(plan?.image_url ?? null);
  const [active, setActive] = useState(plan?.active ?? true);
  const [waive, setWaive] = useState(plan?.waive_deposit ?? true);
  const [rows, setRows] = useState<PlanServiceDraft[]>(
    (plan?.plan_services ?? []).map((s: any) => ({ service_id: s.service_id, sessions: s.sessions, notes: s.notes ?? "" })),
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome do plano ou pacote.");
      if (!rows.length) throw new Error("Adicione pelo menos um serviço.");
      if (rows.some((r) => !r.service_id)) throw new Error("Selecione o serviço em todas as linhas.");
      if (rows.some((r) => !r.sessions || r.sessions < 1)) throw new Error("A quantidade de sessões deve ser maior que zero.");
      const uniq = new Set(rows.map((r) => r.service_id));
      if (uniq.size !== rows.length) throw new Error("Serviço repetido na lista.");

      const payload = {
        company_id: companyId,
        name: name.trim(),
        description: description.trim() || null,
        kind,
        price_cents: inputToCents(price),
        promo_price_cents: promo.trim() ? inputToCents(promo) : null,
        valid_until: validUntil || null,
        sessions_total: sessionsTotal ? Number(sessionsTotal) : null,
        duration_days: durationDays ? Number(durationDays) : null,
        image_url: imageUrl,
        active,
        waive_deposit: waive,
      };

      let planId = plan?.id as string | undefined;
      if (planId) {
        const { error } = await supabase.from("plans").update(payload as never).eq("id", planId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("plans").insert(payload as never).select("id").single();
        if (error) throw error;
        planId = (data as any).id;
      }

      await supabase.from("plan_services").delete().eq("plan_id", planId!);
      const { error: sErr } = await supabase.from("plan_services").insert(
        rows.map((r) => ({
          plan_id: planId!, company_id: companyId, service_id: r.service_id,
          sessions: r.sessions, notes: r.notes.trim() || null,
        })) as never,
      );
      if (sErr) throw sErr;

      await logPlanAudit({
        company_id: companyId, entity: "plan", entity_id: planId,
        action: plan ? "updated" : "created",
        description: `${plan ? "Editado" : "Criado"}: ${payload.name}`,
        old_data: plan ?? null, new_data: { ...payload, services: rows },
      });
    },
    onSuccess: () => {
      toast.success("Plano salvo.");
      void qc.invalidateQueries({ queryKey: ["plans", companyId] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar."),
  });

  return (
    <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{plan ? "Editar" : "Novo"} plano/pacote</DialogTitle></DialogHeader>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pacote Bronze" />
          </div>
          <div className="sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as PlanKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="plan">Plano</SelectItem>
                <SelectItem value="package">Pacote</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor normal (R$)</Label>
            <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <Label>Valor promocional (R$)</Label>
            <Input inputMode="decimal" value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <Label>Data de validade</Label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div>
            <Label>Quantidade de sessões</Label>
            <Input inputMode="numeric" value={sessionsTotal} onChange={(e) => setSessionsTotal(e.target.value.replace(/\D/g, ""))} placeholder="Opcional" />
          </div>
          <div>
            <Label>Dias de duração</Label>
            <Input inputMode="numeric" value={durationDays} onChange={(e) => setDurationDays(e.target.value.replace(/\D/g, ""))} placeholder="Opcional" />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Imagem ilustrativa</Label>
          <ImageUpload value={imageUrl} onChange={setImageUrl} folder="plans" aspect="wide" preset="service" />
        </div>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={active} onCheckedChange={setActive} /> Ativo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={waive} onCheckedChange={setWaive} /> Isentar cobrança de sinal antecipado
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Serviços inclusos *</Label>
            <Button size="sm" variant="outline" onClick={() => setRows((r) => [...r, { service_id: "", sessions: 1, notes: "" }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar serviço
            </Button>
          </div>
          {rows.length === 0 && <p className="text-xs text-muted-foreground">Nenhum serviço adicionado.</p>}
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_90px_1fr_auto] items-end rounded-lg border p-2">
              <div>
                <Label className="text-[11px]">Serviço</Label>
                <Select
                  value={r.service_id}
                  onValueChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, service_id: v } : x)))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {services.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Sessões</Label>
                <Input
                  inputMode="numeric" value={r.sessions}
                  onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, sessions: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)))}
                />
              </div>
              <div>
                <Label className="text-[11px]">Observações</Label>
                <Input
                  value={r.notes}
                  onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)))}
                />
              </div>
              <Button size="icon" variant="ghost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Cancelar</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ================= Vendas ================= */

function SalesTab({
  companyId, isAdmin, plans, sales,
}: { companyId: string; isAdmin: boolean; plans: any[]; sales: any[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sellOpen, setSellOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = sales.filter((s) => {
    const text = [s.plan_name, s.customers?.name, PLAN_KINDS[s.kind as PlanKind]].join(" ").toLowerCase();
    if (search && !text.includes(search.toLowerCase())) return false;
    const expired = isExpiredPlan(s);
    const d = daysUntil(s.expires_at);
    if (status === "active") return s.status === "active" && !expired;
    if (status === "expired") return s.status !== "cancelled" && expired;
    if (status === "cancelled") return s.status === "cancelled";
    if (status === "soon") return s.status === "active" && !expired && d !== null && d >= 0 && d <= 7;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por cliente, plano ou pacote…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="soon">Próximos do vencimento</SelectItem>
            <SelectItem value="expired">Vencidos</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        {isAdmin && (
          <Dialog open={sellOpen} onOpenChange={setSellOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Vender plano</Button>
            </DialogTrigger>
            {sellOpen && <SellDialog companyId={companyId} plans={plans} onDone={() => setSellOpen(false)} />}
          </Dialog>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhuma venda encontrada.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const expired = isExpiredPlan(s);
            const st = s.status === "cancelled" ? "cancelled" : expired ? "expired" : "active";
            const balances = s.customer_plan_services ?? [];
            const total = balances.reduce((t: number, b: any) => t + b.sessions_total, 0);
            const used = balances.reduce((t: number, b: any) => t + b.sessions_used, 0);
            return (
              <Card key={s.id}>
                <CardContent className="p-4 space-y-3">
                  <button
                    className="w-full text-left"
                    onClick={() => setExpanded((x) => (x === s.id ? null : s.id))}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.customers?.name ?? "Cliente"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {PLAN_KINDS[s.kind as PlanKind]} · {s.plan_name} · {brl((s.amount_cents ?? 0) / 100)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Compra {dateBR(s.sold_at)} · Validade {s.expires_at ? dateBR(s.expires_at) : "sem validade"}
                        </p>
                      </div>
                      <Badge variant="outline" className={PLAN_STATUS[st as keyof typeof PLAN_STATUS].className}>
                        {PLAN_STATUS[st as keyof typeof PLAN_STATUS].label}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={total ? (used / total) * 100 : 0} className="h-1.5 flex-1" />
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {used}/{total} sessões
                      </span>
                    </div>
                  </button>

                  {expanded === s.id && (
                    <SaleDetails companyId={companyId} sale={s} isAdmin={isAdmin} />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SaleDetails({ companyId, sale, isAdmin }: { companyId: string; sale: any; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: usage = [] } = usePlanUsage([sale.id]);
  const balances = sale.customer_plan_services ?? [];

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["customer-plans", companyId] });
    void qc.invalidateQueries({ queryKey: ["plan-audit", companyId] });
  };

  const act = useMutation({
    mutationFn: async (action: string) => {
      if (action === "cancel") {
        const reason = prompt("Motivo do cancelamento (opcional):") ?? null;
        const { error } = await supabase
          .from("customer_plans")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: reason } as never)
          .eq("id", sale.id);
        if (error) throw error;
        await logPlanAudit({
          company_id: companyId, entity: "customer_plan", entity_id: sale.id, action: "cancelled",
          description: `Plano cancelado: ${sale.plan_name}`, old_data: { status: sale.status }, new_data: { status: "cancelled", reason },
        });
      }
      if (action === "extend") {
        const days = Number(prompt("Prorrogar validade em quantos dias?", "30") ?? 0);
        if (!days) return;
        const base = sale.expires_at ? new Date(sale.expires_at) : new Date();
        base.setDate(base.getDate() + days);
        const next = base.toISOString().slice(0, 10);
        const { error } = await supabase
          .from("customer_plans").update({ expires_at: next, status: "active" } as never).eq("id", sale.id);
        if (error) throw error;
        await logPlanAudit({
          company_id: companyId, entity: "customer_plan", entity_id: sale.id, action: "extended",
          description: `Validade prorrogada em ${days} dias`, old_data: { expires_at: sale.expires_at }, new_data: { expires_at: next },
        });
      }
      if (action === "renew" || action === "duplicate") {
        const { data: created, error } = await supabase
          .from("customer_plans")
          .insert({
            company_id: companyId, customer_id: sale.customer_id, plan_id: sale.plan_id,
            plan_name: sale.plan_name, kind: sale.kind, amount_cents: sale.amount_cents,
            payment_method: sale.payment_method, expires_at: sale.expires_at, waive_deposit: sale.waive_deposit,
            notes: action === "renew" ? "Renovação" : "Duplicado", renewed_from_id: sale.id,
          } as never)
          .select("id").single();
        if (error) throw error;
        const rows = balances.map((b: any) => ({
          customer_plan_id: (created as any).id, company_id: companyId, service_id: b.service_id,
          service_name: b.service_name, sessions_total: b.sessions_total, sessions_used: 0, notes: b.notes,
        }));
        if (rows.length) {
          const { error: bErr } = await supabase.from("customer_plan_services").insert(rows as never);
          if (bErr) throw bErr;
        }
        await logPlanAudit({
          company_id: companyId, entity: "customer_plan", entity_id: (created as any).id,
          action: action === "renew" ? "renewed" : "duplicated",
          description: `${action === "renew" ? "Renovação" : "Duplicação"} de ${sale.plan_name}`,
          old_data: { from: sale.id }, new_data: { id: (created as any).id },
        });
      }
      if (action === "extra") {
        const svc = balances[0];
        if (!svc) throw new Error("Este plano não possui serviços.");
        const id = prompt(
          `Informe o número do serviço para adicionar sessões:\n${balances.map((b: any, i: number) => `${i + 1} - ${b.service_name}`).join("\n")}`,
          "1",
        );
        const idx = Number(id) - 1;
        const target = balances[idx];
        if (!target) return;
        const qty = Number(prompt(`Quantas sessões extras para ${target.service_name}?`, "1") ?? 0);
        if (!qty) return;
        const { error } = await supabase
          .from("customer_plan_services")
          .update({ sessions_total: target.sessions_total + qty } as never)
          .eq("id", target.id);
        if (error) throw error;
        await logPlanAudit({
          company_id: companyId, entity: "customer_plan", entity_id: sale.id, action: "sessions_added",
          description: `+${qty} sessões de ${target.service_name}`,
          old_data: { sessions_total: target.sessions_total }, new_data: { sessions_total: target.sessions_total + qty },
        });
      }
    },
    onSuccess: () => { toast.success("Operação registrada."); refresh(); },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível concluir."),
  });

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {balances.map((b: any) => {
          const left = Math.max(0, b.sessions_total - b.sessions_used);
          return (
            <div key={b.id} className="rounded-lg border p-2">
              <p className="text-sm font-medium">{b.service_name}</p>
              <p className="text-xs text-muted-foreground">
                Contratadas: {b.sessions_total} · Utilizadas: {b.sessions_used} · Disponíveis: {left}
              </p>
              {b.notes && <p className="text-[11px] text-muted-foreground mt-1">{b.notes}</p>}
            </div>
          );
        })}
      </div>

      {sale.payment_method && (
        <p className="text-xs text-muted-foreground">Forma de pagamento: {sale.payment_method}</p>
      )}
      {sale.notes && <p className="text-xs text-muted-foreground">Observações: {sale.notes}</p>}

      <div>
        <p className="text-xs font-medium mb-1">Histórico de utilização</p>
        {usage.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma sessão utilizada ainda.</p>
        ) : (
          <ul className="space-y-1">
            {usage.map((u: any) => (
              <li key={u.id} className="text-xs text-muted-foreground">
                {new Date(u.used_at).toLocaleString("pt-BR")} · {u.service_name}
                {u.staff_name ? ` · ${u.staff_name}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => act.mutate("renew")}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Renovar</Button>
          <Button size="sm" variant="outline" onClick={() => act.mutate("duplicate")}><Copy className="h-3.5 w-3.5 mr-1" /> Duplicar</Button>
          <Button size="sm" variant="outline" onClick={() => act.mutate("extra")}><PlusCircle className="h-3.5 w-3.5 mr-1" /> Sessões extras</Button>
          <Button size="sm" variant="outline" onClick={() => act.mutate("extend")}><CalendarClock className="h-3.5 w-3.5 mr-1" /> Prorrogar</Button>
          {sale.status !== "cancelled" && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => act.mutate("cancel")}>
              <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function SellDialog({ companyId, plans, onDone }: { companyId: string; plans: any[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [planId, setPlanId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("PIX");
  const [expires, setExpires] = useState("");
  const [notes, setNotes] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");

  const { data: customers = [] } = useQuery({
    enabled: !!companyId,
    queryKey: ["plan-customers", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id,name,phone").eq("company_id", companyId).order("name");
      return data ?? [];
    },
  });

  const plan = plans.find((p) => p.id === planId);

  const pickPlan = (id: string) => {
    setPlanId(id);
    const p = plans.find((x) => x.id === id);
    if (!p) return;
    setAmount(centsToInput(effectivePrice(p)));
    if (p.duration_days) {
      const d = new Date();
      d.setDate(d.getDate() + Number(p.duration_days));
      setExpires(d.toISOString().slice(0, 10));
    } else if (p.valid_until) {
      setExpires(p.valid_until);
    }
  };

  const sell = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error("Selecione o cliente.");
      if (!plan) throw new Error("Selecione o plano ou pacote.");
      const { data: auth } = await supabase.auth.getUser();

      const { data: created, error } = await supabase
        .from("customer_plans")
        .insert({
          company_id: companyId, customer_id: customerId, plan_id: plan.id, plan_name: plan.name,
          kind: plan.kind, amount_cents: inputToCents(amount), payment_method: method,
          sold_by: auth.user?.id ?? null, expires_at: expires || null,
          waive_deposit: plan.waive_deposit, notes: notes.trim() || null,
        } as never)
        .select("id").single();
      if (error) throw error;

      const rows = (plan.plan_services ?? []).map((s: any) => ({
        customer_plan_id: (created as any).id, company_id: companyId, service_id: s.service_id,
        service_name: s.services?.name ?? null, sessions_total: s.sessions, sessions_used: 0, notes: s.notes,
      }));
      if (rows.length) {
        const { error: bErr } = await supabase.from("customer_plan_services").insert(rows as never);
        if (bErr) throw bErr;
      }

      await logPlanAudit({
        company_id: companyId, entity: "customer_plan", entity_id: (created as any).id,
        action: "sold", description: `Venda de ${plan.name}`,
        new_data: { customer_id: customerId, amount_cents: inputToCents(amount), method, expires_at: expires || null },
      });
    },
    onSuccess: () => {
      toast.success("Plano vendido.");
      void qc.invalidateQueries({ queryKey: ["customer-plans", companyId] });
      void qc.invalidateQueries({ queryKey: ["plan-audit", companyId] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar a venda."),
  });

  const filteredCustomers = (customers as any[]).filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()),
  ).slice(0, 50);

  return (
    <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Vender plano/pacote</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Cliente *</Label>
          <Input placeholder="Buscar cliente…" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="mb-2" />
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
            <SelectContent>
              {filteredCustomers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Plano/Pacote *</Label>
          <Select value={planId} onValueChange={pickPlan}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {plans.filter((p) => p.active).map((p) => (
                <SelectItem key={p.id} value={p.id}>{PLAN_KINDS[p.kind as PlanKind]} · {p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Valor da venda (R$)</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data de validade</Label>
            <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Observações</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {plan && (
          <div className="rounded-lg border p-2 text-xs text-muted-foreground">
            Sessões incluídas: {(plan.plan_services ?? []).map((s: any) => `${s.services?.name} (${s.sessions})`).join(", ") || "—"}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Cancelar</Button>
        <Button onClick={() => sell.mutate()} disabled={sell.isPending}>Registrar venda</Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ================= Auditoria ================= */

function AuditTab({ companyId }: { companyId: string }) {
  const { data: logs = [] } = usePlanAudit(companyId);
  if (!logs.length) {
    return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum registro de auditoria.</CardContent></Card>;
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Registros de auditoria</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {logs.map((l: any) => (
            <li key={l.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{l.description ?? l.action}</span>
                <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{l.entity} · {l.action}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
