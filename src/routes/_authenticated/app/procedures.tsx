import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, Copy, Calculator, AlertTriangle, Search, History, Download,
} from "lucide-react";
import { brl } from "@/lib/format";
import {
  COST_PRESETS, UNITS, computeProcedure,
  type ProcedureCost, type ProcedureItem, type ProcedureRow,
} from "@/lib/procedures";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/procedures")({
  component: ProceduresPage,
  head: () => ({
    meta: [
      { title: "Calculadora de Procedimentos | Painel" },
      { name: "description", content: "Composição de insumos, custos e lucratividade de cada procedimento." },
    ],
  }),
});

type Full = ProcedureRow & {
  procedure_items: (ProcedureItem & { id: string })[];
  procedure_costs: (ProcedureCost & { id: string })[];
};

const money = (cents: number | null | undefined) => brl((cents ?? 0) / 100);
const toCents = (v: string | number) => Math.round((parseFloat(String(v) || "0") || 0) * 100);

function ProceduresPage() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const { user, isSuperAdmin } = useAuth();
  const companyId = activeCompany!.id;

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [edit, setEdit] = useState<Full | null>(null);
  const [open, setOpen] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const { data: myRole } = useQuery({
    queryKey: ["my-company-role", companyId, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("company_users").select("role")
        .eq("company_id", companyId).eq("user_id", user!.id).maybeSingle();
      return data?.role ?? null;
    },
  });
  const canManage = isSuperAdmin || myRole === "company_admin";

  const { data: procedures = [], isLoading } = useQuery({
    queryKey: ["procedures", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procedures")
        .select("*, procedure_items(*), procedure_costs(*)")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Full[];
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services-min", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("id, name, price_cents, duration_min, category")
        .eq("company_id", companyId).order("name");
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-min", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("products")
        .select("id, name, unit, cost_price, stock_qty, min_stock, active")
        .eq("company_id", companyId).order("name");
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: { base: Partial<ProcedureRow>; items: ProcedureItem[]; costs: ProcedureCost[]; id?: string }) => {
      const { base, items, costs, id } = payload;
      let procId = id;
      if (id) {
        const { error } = await supabase.from("procedures").update(base as any).eq("id", id);
        if (error) throw error;
        await supabase.from("procedure_items").delete().eq("procedure_id", id);
        await supabase.from("procedure_costs").delete().eq("procedure_id", id);
      } else {
        const { data, error } = await supabase.from("procedures")
          .insert({ ...base, company_id: companyId, created_by: user?.id } as any)
          .select("id").single();
        if (error) throw error;
        procId = data.id;
      }
      if (items.length) {
        const { error } = await supabase.from("procedure_items").insert(
          items.map((i) => ({
            procedure_id: procId, company_id: companyId,
            product_id: i.product_id, product_name: i.product_name,
            quantity: i.quantity, unit: i.unit, unit_cost: i.unit_cost, notes: i.notes,
          })) as any,
        );
        if (error) throw error;
      }
      if (costs.length) {
        const { error } = await supabase.from("procedure_costs").insert(
          costs.map((c) => ({
            procedure_id: procId, company_id: companyId,
            label: c.label, amount_cents: c.amount_cents,
          })) as any,
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Procedimento salvo");
      qc.invalidateQueries({ queryKey: ["procedures", companyId] });
      setOpen(false); setEdit(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("procedures").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Procedimento excluído");
      qc.invalidateQueries({ queryKey: ["procedures", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (p: Full) => {
      const { procedure_items, procedure_costs, id, created_at, updated_at, ...base } = p as any;
      const { data, error } = await supabase.from("procedures")
        .insert({ ...base, name: `${p.name} (cópia)`, created_by: user?.id } as any)
        .select("id").single();
      if (error) throw error;
      if (procedure_items?.length) {
        await supabase.from("procedure_items").insert(
          procedure_items.map((i: any) => ({
            procedure_id: data.id, company_id: companyId, product_id: i.product_id,
            product_name: i.product_name, quantity: i.quantity, unit: i.unit,
            unit_cost: i.unit_cost, notes: i.notes,
          })) as any,
        );
      }
      if (procedure_costs?.length) {
        await supabase.from("procedure_costs").insert(
          procedure_costs.map((c: any) => ({
            procedure_id: data.id, company_id: companyId, label: c.label, amount_cents: c.amount_cents,
          })) as any,
        );
      }
    },
    onSuccess: () => {
      toast.success("Procedimento duplicado");
      qc.invalidateQueries({ queryKey: ["procedures", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const categories = useMemo(
    () => Array.from(new Set(procedures.map((p) => p.category).filter(Boolean))) as string[],
    [procedures],
  );

  const serviceName = (id: string | null) => services.find((s) => s.id === id)?.name ?? null;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return procedures.filter((p) => {
      if (statusFilter === "active" && !p.active) return false;
      if (statusFilter === "inactive" && p.active) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (!term) return true;
      return [p.name, p.category ?? "", serviceName(p.service_id) ?? ""]
        .join(" ").toLowerCase().includes(term);
    });
  }, [procedures, q, statusFilter, categoryFilter, services]);

  const stats = useMemo(() => {
    const maths = procedures.map((p) => computeProcedure(p, p.procedure_items ?? [], p.procedure_costs ?? []));
    const n = maths.length || 1;
    const usage = new Map<string, number>();
    procedures.forEach((p) =>
      (p.procedure_items ?? []).forEach((i) => {
        if (!i.product_id) return;
        usage.set(i.product_id, (usage.get(i.product_id) ?? 0) + Number(i.quantity || 0));
      }),
    );
    const topProducts = [...usage.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([pid, qty]) => ({ name: products.find((x) => x.id === pid)?.name ?? "—", qty }));
    const lowStock = products.filter((p: any) => p.active && Number(p.stock_qty) <= Number(p.min_stock));
    return {
      total: procedures.length,
      active: procedures.filter((p) => p.active).length,
      avgCost: maths.reduce((s, m) => s + m.totalCost, 0) / n,
      avgProfit: maths.reduce((s, m) => s + m.grossProfit, 0) / n,
      topProducts,
      lowStock,
    };
  }, [procedures, products]);

  const exportCsv = () => {
    const rows = [
      ["Procedimento", "Serviço", "Categoria", "Status", "Valor", "Custo total", "Lucro", "Margem %"],
      ...filtered.map((p) => {
        const m = computeProcedure(p, p.procedure_items ?? [], p.procedure_costs ?? []);
        return [
          p.name, serviceName(p.service_id) ?? "", p.category ?? "",
          p.active ? "Ativo" : "Inativo",
          m.price.toFixed(2), m.totalCost.toFixed(2), m.grossProfit.toFixed(2), m.marginPct.toFixed(1),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "procedimentos.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Calculadora de Procedimentos</h1>
          <p className="text-sm text-muted-foreground">
            Composição de insumos, custos reais e lucratividade por atendimento.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAudit(true)}>
            <History className="h-4 w-4 mr-2" /> Histórico
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
          {canManage && (
            <Button onClick={() => { setEdit(null); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Novo procedimento
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi label="Procedimentos" value={String(stats.total)} />
        <Kpi label="Ativos" value={String(stats.active)} />
        <Kpi label="Custo médio" value={brl(stats.avgCost || 0)} />
        <Kpi label="Lucro médio" value={brl(stats.avgProfit || 0)} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium mb-2">Produtos mais consumidos</p>
            {stats.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum insumo cadastrado ainda.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {stats.topProducts.map((p) => (
                  <li key={p.name} className="flex justify-between">
                    <span className="truncate">{p.name}</span>
                    <span className="text-muted-foreground">{p.qty}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className={stats.lowStock.length ? "border-amber-500/40" : ""}>
          <CardContent className="p-5">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              {!!stats.lowStock.length && <AlertTriangle className="h-4 w-4 text-amber-500" />}
              Insumos no estoque mínimo
            </p>
            {stats.lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum alerta de estoque.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {stats.lowStock.slice(0, 6).map((p: any) => (
                  <li key={p.id} className="flex justify-between">
                    <span className="truncate">{p.name}</span>
                    <span className="text-amber-600">{Number(p.stock_qty)} {p.unit}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, serviço ou categoria"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calculator className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhum procedimento encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const m = computeProcedure(p, p.procedure_items ?? [], p.procedure_costs ?? []);
            return (
              <Card key={p.id} className={p.active ? "" : "opacity-60"}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[serviceName(p.service_id), p.category, `${p.duration_min} min`]
                          .filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {canManage && (
                        <>
                          <Button size="icon" variant="ghost" title="Duplicar" onClick={() => duplicate.mutate(p)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { setEdit(p); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost"
                            onClick={() => confirm(`Excluir "${p.name}"?`) && del.mutate(p.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <Mini label="Valor" value={brl(m.price)} />
                    <Mini label="Custo" value={brl(m.totalCost)} />
                    <Mini label="Lucro" value={brl(m.grossProfit)}
                      className={m.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"} />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <Badge variant="outline">{(p.procedure_items ?? []).length} insumo(s)</Badge>
                    <span className="text-muted-foreground">
                      Margem {m.marginPct.toFixed(1)}% · Custo {m.costPct.toFixed(1)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
        {open && (
          <ProcedureDialog
            key={edit?.id ?? "new"}
            edit={edit}
            services={services as any[]}
            products={products as any[]}
            others={procedures.filter((p) => p.id !== edit?.id)}
            loading={save.isPending}
            onSave={(base, items, costs) => save.mutate({ base, items, costs, id: edit?.id })}
          />
        )}
      </Dialog>

      <Dialog open={showAudit} onOpenChange={setShowAudit}>
        {showAudit && <AuditDialog companyId={companyId} />}
      </Dialog>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </CardContent></Card>
  );
}

function Mini({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-semibold text-sm ${className}`}>{value}</p>
    </div>
  );
}

function ProcedureDialog({
  edit, services, products, others, loading, onSave,
}: {
  edit: Full | null;
  services: any[];
  products: any[];
  others: Full[];
  loading: boolean;
  onSave: (base: Partial<ProcedureRow>, items: ProcedureItem[], costs: ProcedureCost[]) => void;
}) {
  const [f, setF] = useState<Partial<ProcedureRow>>(
    edit ?? {
      name: "", service_id: null, category: "", duration_min: 60,
      suggested_price_cents: 0, min_price_cents: 0, ideal_price_cents: 0,
      practiced_price_cents: null, description: "", active: true,
      labor_hour_rate_cents: 0, commission_type: "percent", commission_value: 0,
      other_costs_cents: 0,
    },
  );
  const [items, setItems] = useState<ProcedureItem[]>(edit?.procedure_items ?? []);
  const [costs, setCosts] = useState<ProcedureCost[]>(edit?.procedure_costs ?? []);

  const m = computeProcedure(
    {
      duration_min: f.duration_min ?? 0,
      labor_hour_rate_cents: f.labor_hour_rate_cents ?? 0,
      commission_type: f.commission_type ?? "percent",
      commission_value: f.commission_value ?? 0,
      other_costs_cents: f.other_costs_cents ?? 0,
      practiced_price_cents: f.practiced_price_cents ?? null,
      suggested_price_cents: f.suggested_price_cents ?? 0,
    },
    items, costs,
  );

  const addItem = () =>
    setItems((s) => [...s, { product_id: null, product_name: "", quantity: 1, unit: "un", unit_cost: 0, notes: "" }]);

  const setItem = (idx: number, patch: Partial<ProcedureItem>) =>
    setItems((s) => s.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const pickProduct = (idx: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    setItem(idx, {
      product_id: productId,
      product_name: p?.name ?? null,
      unit: p?.unit ?? "un",
      unit_cost: Number(p?.cost_price ?? 0),
    });
  };

  const importFrom = (procId: string) => {
    const src = others.find((p) => p.id === procId);
    if (!src) return;
    setItems((s) => [
      ...s,
      ...(src.procedure_items ?? []).map((i) => ({
        product_id: i.product_id, product_name: i.product_name,
        quantity: Number(i.quantity), unit: i.unit, unit_cost: Number(i.unit_cost), notes: i.notes,
      })),
    ]);
    toast.success(`Insumos importados de "${src.name}"`);
  };

  const submit = () => {
    if (!f.name?.trim()) return toast.error("Informe o nome do procedimento");
    if ((f.duration_min ?? 0) <= 0) return toast.error("Informe o tempo médio de execução");
    if (items.some((i) => !i.product_id && !i.product_name?.trim()))
      return toast.error("Todo insumo precisa de um produto");
    if (items.some((i) => Number(i.quantity) <= 0))
      return toast.error("Quantidade dos insumos deve ser maior que zero");
    onSave(
      {
        name: f.name!.trim(),
        service_id: f.service_id || null,
        category: f.category?.trim() || null,
        duration_min: Number(f.duration_min) || 0,
        suggested_price_cents: f.suggested_price_cents ?? 0,
        min_price_cents: f.min_price_cents ?? 0,
        ideal_price_cents: f.ideal_price_cents ?? 0,
        practiced_price_cents: f.practiced_price_cents ?? null,
        description: f.description?.trim() || null,
        active: f.active ?? true,
        labor_hour_rate_cents: f.labor_hour_rate_cents ?? 0,
        commission_type: f.commission_type ?? "percent",
        commission_value: Number(f.commission_value) || 0,
        other_costs_cents: f.other_costs_cents ?? 0,
      },
      items, costs.filter((c) => c.label.trim()),
    );
  };

  return (
    <DialogContent
      className="sm:max-w-3xl max-h-[92dvh] overflow-y-auto"
      onInteractOutside={(e) => e.preventDefault()}
    >
      <DialogHeader>
        <DialogTitle>{edit ? "Editar procedimento" : "Novo procedimento"}</DialogTitle>
      </DialogHeader>

      <Tabs defaultValue="dados">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="custos">Custos</TabsTrigger>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="space-y-3 pt-3">
          <div><Label>Nome do procedimento</Label>
            <Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Serviço correspondente</Label>
              <Select value={f.service_id ?? "none"}
                onValueChange={(v) => {
                  const s = services.find((x) => x.id === v);
                  setF((prev) => ({
                    ...prev,
                    service_id: v === "none" ? null : v,
                    suggested_price_cents: prev.suggested_price_cents || s?.price_cents || 0,
                    duration_min: prev.duration_min || s?.duration_min || 60,
                    category: prev.category || s?.category || "",
                  }));
                }}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Categoria</Label>
              <Input value={f.category ?? ""} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Tempo médio (min)</Label>
              <Input type="number" value={f.duration_min ?? 0}
                onChange={(e) => setF({ ...f, duration_min: parseInt(e.target.value || "0") })} /></div>
            <div><Label>Valor sugerido (R$)</Label>
              <Input type="number" step="0.01" value={(f.suggested_price_cents ?? 0) / 100}
                onChange={(e) => setF({ ...f, suggested_price_cents: toCents(e.target.value) })} /></div>
            <div><Label>Valor mínimo (R$)</Label>
              <Input type="number" step="0.01" value={(f.min_price_cents ?? 0) / 100}
                onChange={(e) => setF({ ...f, min_price_cents: toCents(e.target.value) })} /></div>
            <div><Label>Valor ideal (R$)</Label>
              <Input type="number" step="0.01" value={(f.ideal_price_cents ?? 0) / 100}
                onChange={(e) => setF({ ...f, ideal_price_cents: toCents(e.target.value) })} /></div>
            <div><Label>Valor praticado (R$)</Label>
              <Input type="number" step="0.01"
                value={f.practiced_price_cents == null ? "" : f.practiced_price_cents / 100}
                placeholder="Opcional"
                onChange={(e) => setF({
                  ...f, practiced_price_cents: e.target.value === "" ? null : toCents(e.target.value),
                })} /></div>
          </div>
          <div><Label>Descrição</Label>
            <Textarea value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="flex items-center justify-between">
            <Label>Ativo</Label>
            <Switch checked={f.active ?? true} onCheckedChange={(v) => setF({ ...f, active: v })} />
          </div>
        </TabsContent>

        <TabsContent value="insumos" className="space-y-3 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-2" /> Adicionar insumo</Button>
            {others.length > 0 && (
              <Select value="" onValueChange={importFrom}>
                <SelectTrigger className="w-[240px] h-9">
                  <SelectValue placeholder="Importar de outro procedimento" />
                </SelectTrigger>
                <SelectContent>
                  {others.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {!items.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum insumo. Adicione os produtos consumidos neste procedimento.
            </p>
          ) : items.map((it, idx) => (
            <Card key={idx}>
              <CardContent className="p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Produto</Label>
                    <Select value={it.product_id ?? ""} onValueChange={(v) => pickProduct(idx, v)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label>Qtd</Label>
                      <Input type="number" step="0.001" value={it.quantity}
                        onChange={(e) => setItem(idx, { quantity: parseFloat(e.target.value || "0") })} /></div>
                    <div>
                      <Label>Unidade</Label>
                      <Select value={it.unit} onValueChange={(v) => setItem(idx, { unit: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Valor un.</Label>
                      <Input type="number" step="0.0001" value={it.unit_cost}
                        onChange={(e) => setItem(idx, { unit_cost: parseFloat(e.target.value || "0") })} /></div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 items-end">
                  <div><Label>Observações</Label>
                    <Input value={it.notes ?? ""} placeholder="Opcional"
                      onChange={(e) => setItem(idx, { notes: e.target.value })} /></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Valor consumido</p>
                      <p className="font-semibold">
                        {brl((Number(it.quantity) || 0) * (Number(it.unit_cost) || 0))}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost"
                      onClick={() => setItems((s) => s.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-between text-sm font-medium border-t pt-3">
            <span>Custo total dos insumos</span>
            <span>{brl(m.productsCost)}</span>
          </div>
        </TabsContent>

        <TabsContent value="custos" className="space-y-4 pt-3">
          <div className="space-y-3">
            <p className="text-sm font-medium">Mão de obra</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label>Tempo (min)</Label>
                <Input type="number" value={f.duration_min ?? 0}
                  onChange={(e) => setF({ ...f, duration_min: parseInt(e.target.value || "0") })} /></div>
              <div><Label>Valor da hora (R$)</Label>
                <Input type="number" step="0.01" value={(f.labor_hour_rate_cents ?? 0) / 100}
                  onChange={(e) => setF({ ...f, labor_hour_rate_cents: toCents(e.target.value) })} /></div>
              <div>
                <Label>Comissão</Label>
                <div className="flex gap-2">
                  <Select value={f.commission_type ?? "percent"}
                    onValueChange={(v) => setF({ ...f, commission_type: v })}>
                    <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">%</SelectItem>
                      <SelectItem value="fixed">R$</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" step="0.01" value={f.commission_value ?? 0}
                    onChange={(e) => setF({ ...f, commission_value: parseFloat(e.target.value || "0") })} />
                </div>
              </div>
            </div>
            <div><Label>Outros custos operacionais (R$)</Label>
              <Input type="number" step="0.01" value={(f.other_costs_cents ?? 0) / 100}
                onChange={(e) => setF({ ...f, other_costs_cents: toCents(e.target.value) })} /></div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Custos operacionais detalhados</p>
              <Button size="sm" variant="outline"
                onClick={() => setCosts((s) => [...s, { label: "", amount_cents: 0 }])}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {COST_PRESETS.map((p) => (
                <Button key={p} size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={() => setCosts((s) => [...s, { label: p, amount_cents: 0 }])}>
                  + {p}
                </Button>
              ))}
            </div>
            {costs.map((c, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Input value={c.label} placeholder="Categoria de custo"
                  onChange={(e) => setCosts((s) => s.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} />
                <Input type="number" step="0.01" className="w-32" value={c.amount_cents / 100}
                  onChange={(e) => setCosts((s) => s.map((x, i) => i === idx ? { ...x, amount_cents: toCents(e.target.value) } : x))} />
                <Button size="icon" variant="ghost" onClick={() => setCosts((s) => s.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="resumo" className="pt-3">
          <Card><CardContent className="p-5 space-y-2 text-sm">
            <Row label="Valor do serviço" value={brl(m.price)} />
            <Row label="Custo dos produtos" value={brl(m.productsCost)} />
            <Row label="Custo da mão de obra" value={brl(m.laborCost)} />
            <Row label="Comissão" value={brl(m.commissionCost)} />
            <Row label="Custos operacionais" value={brl(m.operationalCost)} />
            <Separator />
            <Row label="Custo total" value={brl(m.totalCost)} strong />
            <Row label="Lucro bruto" value={brl(m.grossProfit)} strong
              className={m.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"} />
            <Row label="Margem de lucro" value={`${m.marginPct.toFixed(1)}%`} />
            <Row label="Percentual de custo" value={`${m.costPct.toFixed(1)}%`} />
            {(f.min_price_cents ?? 0) > 0 && m.price < (f.min_price_cents ?? 0) / 100 && (
              <p className="text-xs text-amber-600 flex items-center gap-1 pt-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Valor praticado abaixo do valor mínimo
                ({money(f.min_price_cents)}).
              </p>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button onClick={submit} disabled={loading}>Salvar procedimento</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Row({ label, value, strong, className = "" }: {
  label: string; value: string; strong?: boolean; className?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${strong ? "font-semibold" : ""} ${className}`}>{value}</span>
    </div>
  );
}

function AuditDialog({ companyId }: { companyId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["procedure-audit", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("procedure_audit_log").select("*")
        .eq("company_id", companyId).order("created_at", { ascending: false }).limit(150);
      return data ?? [];
    },
  });
  const actionLabel: Record<string, string> = {
    created: "Criado", updated: "Alterado", deleted: "Excluído",
  };
  const entityLabel: Record<string, string> = {
    procedure: "Procedimento", item: "Insumo", cost: "Custo",
  };
  return (
    <DialogContent className="sm:max-w-2xl max-h-[85dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Histórico de alterações</DialogTitle></DialogHeader>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !data.length ? (
        <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((l: any) => (
            <li key={l.id} className="rounded-lg border p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium truncate">
                  {entityLabel[l.entity] ?? l.entity} · {actionLabel[l.action] ?? l.action}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(l.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{l.procedure_name ?? "—"}</p>
            </li>
          ))}
        </ul>
      )}
    </DialogContent>
  );
}
