import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, Copy, Calculator, AlertTriangle, Search, History,
  Download, Settings2, FlaskConical, TrendingUp, FileText,
} from "lucide-react";
import { brl } from "@/lib/format";
import {
  COST_PRESETS, UNITS, SUGGESTED_CUSTOM, DEFAULT_COSTING,
  computeProcedure, conversionFactor, itemCost, itemConvertedQty, procedureAlerts,
  type CostingSettings, type OverheadCost, type ProcedureCost, type ProcedureItem,
  type ProcedureRow, type ProductLite, type UnitConversion,
} from "@/lib/procedures";
import { saveProcedure } from "@/lib/procedures.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/procedures")({
  component: ProceduresPage,
  head: () => ({
    meta: [
      { title: "Calculadora de Procedimentos | Painel" },
      { name: "description", content: "Custo real, formação de preço, consumo de insumos e lucratividade por procedimento." },
    ],
  }),
});

type Full = ProcedureRow & {
  procedure_items: (ProcedureItem & { id: string })[];
  procedure_costs: (ProcedureCost & { id: string })[];
};

const toCents = (v: string | number) => Math.round((parseFloat(String(v) || "0") || 0) * 100);
const pct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;

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
  const [showSettings, setShowSettings] = useState(false);

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
    queryKey: ["products-costing", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("products")
        .select("id, name, unit, cost_price, avg_cost, last_cost, stock_qty, min_stock, batch, expires_on, active, scope, category")
        .eq("company_id", companyId).order("name");
      return (data ?? []) as unknown as ProductLite[];
    },
  });

  const { data: conversions = [] } = useQuery({
    queryKey: ["unit-conversions", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("unit_conversions").select("*").eq("company_id", companyId);
      return (data ?? []) as unknown as UnitConversion[];
    },
  });

  const { data: overheads = [] } = useQuery({
    queryKey: ["overhead-costs", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("overhead_costs").select("*").eq("company_id", companyId).order("label");
      return (data ?? []) as unknown as OverheadCost[];
    },
  });

  const { data: settings = DEFAULT_COSTING } = useQuery({
    queryKey: ["costing-settings", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("costing_settings").select("*").eq("company_id", companyId).maybeSingle();
      return (data ? { ...DEFAULT_COSTING, ...(data as any) } : DEFAULT_COSTING) as CostingSettings;
    },
  });

  const serviceProducts = useMemo(
    () => products.filter((p) => (p.scope ?? "service") === "service" && p.active !== false),
    [products],
  );

  const calcOpts = { conversions, overheads, settings };
  const mathOf = (p: Full) =>
    computeProcedure(p as any, p.procedure_items ?? [], p.procedure_costs ?? [], calcOpts);

  const saveFn = useServerFn(saveProcedure);
  const save = useMutation({
    mutationFn: async (payload: { base: any; items: ProcedureItem[]; costs: ProcedureCost[]; id?: string }) =>
      saveFn({ data: { companyId, id: payload.id ?? null, base: payload.base, items: payload.items, costs: payload.costs } }),
    onSuccess: () => {
      toast.success("Procedimento salvo");
      qc.invalidateQueries({ queryKey: ["procedures", companyId] });
      setOpen(false); setEdit(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar"),
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
            purchase_unit: i.purchase_unit, consumption_unit: i.consumption_unit,
            conversion_factor: i.conversion_factor, unit_cost: i.unit_cost, notes: i.notes,
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
      return [p.name, p.category ?? "", p.subcategory ?? "", serviceName(p.service_id) ?? ""]
        .join(" ").toLowerCase().includes(term);
    });
  }, [procedures, q, statusFilter, categoryFilter, services]);

  const stats = useMemo(() => {
    const rows = procedures.map((p) => ({ p, m: mathOf(p) }));
    const n = rows.length || 1;
    const usage = new Map<string, { qty: number; cost: number }>();
    procedures.forEach((p) =>
      (p.procedure_items ?? []).forEach((i) => {
        if (!i.product_id) return;
        const cur = usage.get(i.product_id) ?? { qty: 0, cost: 0 };
        usage.set(i.product_id, {
          qty: cur.qty + itemConvertedQty(i, conversions),
          cost: cur.cost + itemCost(i, conversions),
        });
      }),
    );
    const byUsage = [...usage.entries()].map(([pid, v]) => ({
      name: products.find((x) => x.id === pid)?.name ?? "—", ...v,
    }));
    const ranked = [...rows].sort((a, b) => b.m.netProfit - a.m.netProfit);
    return {
      total: procedures.length,
      active: procedures.filter((p) => p.active).length,
      avgCost: rows.reduce((s, r) => s + r.m.totalCost, 0) / n,
      avgProfit: rows.reduce((s, r) => s + r.m.netProfit, 0) / n,
      avgMargin: rows.reduce((s, r) => s + r.m.marginPct, 0) / n,
      topProducts: [...byUsage].sort((a, b) => b.qty - a.qty).slice(0, 5),
      costlyProducts: [...byUsage].sort((a, b) => b.cost - a.cost).slice(0, 5),
      best: ranked.slice(0, 5),
      worst: ranked.slice(-5).reverse(),
      lowStock: serviceProducts.filter((p) => Number(p.stock_qty ?? 0) <= Number(p.min_stock ?? 0)),
      losing: rows.filter((r) => r.m.price > 0 && r.m.netProfit < 0).length,
    };
  }, [procedures, products, conversions, overheads, settings]);

  const reportRows = () => [
    ["Procedimento", "Serviço", "Categoria", "Status", "Preço", "Insumos", "Mão de obra", "Comissão", "Operacional", "Rateio", "Custo total", "Lucro líquido", "Margem %"],
    ...filtered.map((p) => {
      const m = mathOf(p);
      return [
        p.name, serviceName(p.service_id) ?? "", p.category ?? "", p.active ? "Ativo" : "Inativo",
        m.price.toFixed(2), m.productsCost.toFixed(2), m.laborCost.toFixed(2), m.commissionCost.toFixed(2),
        m.operationalCost.toFixed(2), m.overheadCost.toFixed(2), m.totalCost.toFixed(2),
        m.netProfit.toFixed(2), m.marginPct.toFixed(1),
      ];
    }),
  ];

  const exportCsv = () => {
    const csv = reportRows().map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "procedimentos.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape" });
    const rows = reportRows();
    doc.setFontSize(14);
    doc.text("Relatório de Procedimentos", 14, 14);
    doc.setFontSize(8);
    let y = 24;
    rows.forEach((r, idx) => {
      if (y > 195) { doc.addPage(); y = 16; }
      if (idx === 0) doc.setFont("helvetica", "bold"); else doc.setFont("helvetica", "normal");
      r.forEach((cell, c) => doc.text(String(cell).slice(0, 22), 14 + c * 21, y));
      y += 6;
    });
    doc.save("procedimentos.pdf");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Calculadora de Procedimentos</h1>
          <p className="text-sm text-muted-foreground">
            Custo real, formação de preço, consumo automático de insumos e lucratividade.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              <Settings2 className="h-4 w-4 mr-2" /> Custeio
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowAudit(true)}>
            <History className="h-4 w-4 mr-2" /> Auditoria
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
          {canManage && (
            <Button onClick={() => { setEdit(null); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Novo procedimento
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Kpi label="Procedimentos" value={String(stats.total)} />
        <Kpi label="Ativos" value={String(stats.active)} />
        <Kpi label="Custo médio" value={brl(stats.avgCost || 0)} />
        <Kpi label="Lucro médio" value={brl(stats.avgProfit || 0)} />
        <Kpi label="Margem média" value={pct(stats.avgMargin || 0)} />
      </div>

      {(stats.losing > 0 || stats.lowStock.length > 0) && (
        <Card className="border-amber-500/40">
          <CardContent className="p-4 text-sm space-y-1">
            {stats.losing > 0 && (
              <p className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" /> {stats.losing} procedimento(s) operando no prejuízo.
              </p>
            )}
            {stats.lowStock.length > 0 && (
              <p className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" /> {stats.lowStock.length} insumo(s) no estoque mínimo ou zerados.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ListCard title="Mais lucrativos" icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
          rows={stats.best.map((r) => ({ label: r.p.name, value: brl(r.m.netProfit) }))} />
        <ListCard title="Menos lucrativos"
          rows={stats.worst.map((r) => ({ label: r.p.name, value: brl(r.m.netProfit) }))} />
        <ListCard title="Produtos mais consumidos"
          rows={stats.topProducts.map((p) => ({ label: p.name, value: p.qty.toFixed(2) }))} />
        <ListCard title="Produtos de maior custo"
          rows={stats.costlyProducts.map((p) => ({ label: p.name, value: brl(p.cost) }))} />
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
            const m = mathOf(p);
            const alerts = procedureAlerts(m, p.procedure_items ?? [], products, conversions, settings.min_margin_pct);
            return (
              <Card key={p.id} className={p.active ? "" : "opacity-60"}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[serviceName(p.service_id), p.category, p.subcategory, `${p.duration_min} min`]
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
                    <Mini label="Preço" value={brl(m.price)} />
                    <Mini label="Custo" value={brl(m.totalCost)} />
                    <Mini label="Lucro líq." value={brl(m.netProfit)}
                      className={m.netProfit >= 0 ? "text-emerald-600" : "text-red-600"} />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <Badge variant="outline">{(p.procedure_items ?? []).length} insumo(s)</Badge>
                    <span className="text-muted-foreground">
                      Margem {pct(m.marginPct)} · Custo {pct(m.costPct)}
                    </span>
                  </div>

                  {alerts.length > 0 && (
                    <p className="text-xs text-amber-600 flex items-start gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {alerts[0].message}{alerts.length > 1 ? ` (+${alerts.length - 1})` : ""}
                    </p>
                  )}
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
            products={serviceProducts}
            allProducts={products}
            others={procedures.filter((p) => p.id !== edit?.id)}
            conversions={conversions}
            overheads={overheads}
            settings={settings}
            loading={save.isPending}
            onSave={(base, items, costs) => save.mutate({ base, items, costs, id: edit?.id })}
          />
        )}
      </Dialog>

      <Dialog open={showAudit} onOpenChange={setShowAudit}>
        {showAudit && <AuditDialog companyId={companyId} />}
      </Dialog>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        {showSettings && (
          <CostingSettingsDialog
            companyId={companyId}
            settings={settings}
            overheads={overheads}
            conversions={conversions}
            products={serviceProducts}
          />
        )}
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

function ListCard({ title, rows, icon }: {
  title: string; rows: { label: string; value: string }[]; icon?: React.ReactNode;
}) {
  return (
    <Card><CardContent className="p-5">
      <p className="text-sm font-medium mb-2 flex items-center gap-2">{icon}{title}</p>
      {!rows.length ? (
        <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {rows.map((r, i) => (
            <li key={`${r.label}-${i}`} className="flex justify-between gap-2">
              <span className="truncate">{r.label}</span>
              <span className="text-muted-foreground shrink-0">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
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

function ProcedureDialog({
  edit, services, products, allProducts, others, conversions, overheads, settings, loading, onSave,
}: {
  edit: Full | null;
  services: any[];
  products: ProductLite[];
  allProducts: ProductLite[];
  others: Full[];
  conversions: UnitConversion[];
  overheads: OverheadCost[];
  settings: CostingSettings;
  loading: boolean;
  onSave: (base: any, items: ProcedureItem[], costs: ProcedureCost[]) => void;
}) {
  const [f, setF] = useState<any>(
    edit ?? {
      name: "", service_id: null, category: "", subcategory: "", duration_min: 60,
      duration_min_min: null, duration_max_min: null,
      suggested_price_cents: 0, min_price_cents: 0, ideal_price_cents: 0,
      practiced_price_cents: null, promo_price_cents: null, image_url: null,
      description: "", active: true,
      labor_hour_rate_cents: 0, commission_type: "percent", commission_value: 0,
      other_costs_cents: 0, target_margin_pct: settings.default_margin_pct,
      block_below_cost: settings.block_below_cost, apply_overhead: true,
    },
  );
  const [items, setItems] = useState<ProcedureItem[]>(edit?.procedure_items ?? []);
  const [costs, setCosts] = useState<ProcedureCost[]>(edit?.procedure_costs ?? []);

  // Simulador (não altera os dados oficiais até "Aplicar")
  const [simOn, setSimOn] = useState(false);
  const [sim, setSim] = useState({ qtyFactor: 1, costFactor: 1, commission: 0, duration: 0, margin: 0, operational: 1 });

  const baseCalc = (over?: Partial<any>) => ({
    duration_min: Number(f.duration_min) || 0,
    labor_hour_rate_cents: Number(f.labor_hour_rate_cents) || 0,
    commission_type: f.commission_type ?? "percent",
    commission_value: Number(f.commission_value) || 0,
    other_costs_cents: Number(f.other_costs_cents) || 0,
    practiced_price_cents: f.practiced_price_cents ?? null,
    suggested_price_cents: Number(f.suggested_price_cents) || 0,
    promo_price_cents: f.promo_price_cents ?? null,
    target_margin_pct: Number(f.target_margin_pct ?? settings.default_margin_pct),
    apply_overhead: f.apply_overhead !== false,
    ...over,
  });

  const opts = { conversions, overheads, settings };
  const m = computeProcedure(baseCalc(), items, costs, opts);

  const simItems = items.map((i) => ({
    ...i,
    quantity: Number(i.quantity) * sim.qtyFactor,
    unit_cost: Number(i.unit_cost) * sim.costFactor,
  }));
  const simCosts = costs.map((c) => ({ ...c, amount_cents: Math.round(c.amount_cents * sim.operational) }));
  const simMath = computeProcedure(
    baseCalc({
      duration_min: sim.duration || Number(f.duration_min) || 0,
      commission_value: sim.commission || Number(f.commission_value) || 0,
      target_margin_pct: sim.margin || Number(f.target_margin_pct ?? settings.default_margin_pct),
    }),
    simItems, simCosts, opts,
  );

  const alerts = procedureAlerts(m, items, allProducts, conversions, settings.min_margin_pct);

  const addItem = () =>
    setItems((s) => [...s, {
      product_id: null, product_name: "", quantity: 1, unit: "un",
      purchase_unit: "un", consumption_unit: "un", unit_cost: 0, notes: "",
    }]);

  const setItem = (idx: number, patch: Partial<ProcedureItem>) =>
    setItems((s) => s.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const pickProduct = (idx: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    const unit = p?.unit ?? "un";
    const cost = Number(p?.avg_cost ?? 0) > 0 ? Number(p?.avg_cost) : Number(p?.cost_price ?? 0);
    setItem(idx, {
      product_id: productId,
      product_name: p?.name ?? null,
      category: p?.category ?? null,
      unit,
      purchase_unit: unit,
      consumption_unit: unit,
      unit_cost: cost,
    });
  };

  const importFrom = (procId: string) => {
    const src = others.find((p) => p.id === procId);
    if (!src) return;
    setItems((s) => [...s, ...(src.procedure_items ?? []).map((i) => ({ ...i, id: undefined }))]);
    toast.success(`Insumos importados de "${src.name}"`);
  };

  const applyPrice = (v: number) => setF((prev: any) => ({ ...prev, practiced_price_cents: Math.round(v * 100) }));

  const submit = () => {
    if (!f.name?.trim()) return toast.error("Informe o nome do procedimento");
    if ((Number(f.duration_min) || 0) <= 0) return toast.error("Informe o tempo médio de execução");
    if (items.some((i) => !i.product_id)) return toast.error("Todo insumo deve vir do Estoque de Atendimento");
    if (items.some((i) => Number(i.quantity) <= 0)) return toast.error("Quantidade dos insumos deve ser maior que zero");
    onSave(
      {
        name: f.name.trim(),
        service_id: f.service_id || null,
        category: f.category?.trim() || null,
        subcategory: f.subcategory?.trim() || null,
        duration_min: Number(f.duration_min) || 0,
        duration_min_min: f.duration_min_min ? Number(f.duration_min_min) : null,
        duration_max_min: f.duration_max_min ? Number(f.duration_max_min) : null,
        suggested_price_cents: Number(f.suggested_price_cents) || 0,
        min_price_cents: Number(f.min_price_cents) || 0,
        ideal_price_cents: Number(f.ideal_price_cents) || 0,
        practiced_price_cents: f.practiced_price_cents ?? null,
        promo_price_cents: f.promo_price_cents ?? null,
        image_url: f.image_url || null,
        description: f.description?.trim() || null,
        active: f.active ?? true,
        labor_hour_rate_cents: Number(f.labor_hour_rate_cents) || 0,
        commission_type: f.commission_type ?? "percent",
        commission_value: Number(f.commission_value) || 0,
        other_costs_cents: Number(f.other_costs_cents) || 0,
        target_margin_pct: Number(f.target_margin_pct ?? settings.default_margin_pct),
        block_below_cost: f.block_below_cost !== false,
        apply_overhead: f.apply_overhead !== false,
      },
      items, costs.filter((c) => c.label.trim()),
    );
  };

  return (
    <DialogContent
      className="sm:max-w-4xl max-h-[92dvh] overflow-y-auto"
      onInteractOutside={(e) => e.preventDefault()}
    >
      <DialogHeader>
        <DialogTitle>{edit ? "Editar procedimento" : "Novo procedimento"}</DialogTitle>
      </DialogHeader>

      <Tabs defaultValue="dados">
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full h-auto">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="valores">Valores</TabsTrigger>
          <TabsTrigger value="insumos">Composição</TabsTrigger>
          <TabsTrigger value="custos">Custos</TabsTrigger>
          <TabsTrigger value="simulador">Simulador</TabsTrigger>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="space-y-3 pt-3">
          <div><Label>Nome do procedimento</Label>
            <Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Serviço correspondente</Label>
              <Select value={f.service_id ?? "none"}
                onValueChange={(v) => {
                  const s = services.find((x) => x.id === v);
                  setF((prev: any) => ({
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
            <div><Label>Subcategoria</Label>
              <Input value={f.subcategory ?? ""} onChange={(e) => setF({ ...f, subcategory: e.target.value })} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Tempo médio (min)</Label>
              <Input type="number" value={f.duration_min ?? 0}
                onChange={(e) => setF({ ...f, duration_min: parseInt(e.target.value || "0") })} /></div>
            <div><Label>Tempo mínimo (min)</Label>
              <Input type="number" value={f.duration_min_min ?? ""}
                onChange={(e) => setF({ ...f, duration_min_min: e.target.value === "" ? null : parseInt(e.target.value) })} /></div>
            <div><Label>Tempo máximo (min)</Label>
              <Input type="number" value={f.duration_max_min ?? ""}
                onChange={(e) => setF({ ...f, duration_max_min: e.target.value === "" ? null : parseInt(e.target.value) })} /></div>
          </div>
          <div><Label>Descrição</Label>
            <Textarea value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="flex items-center justify-between">
            <Label>Ativo</Label>
            <Switch checked={f.active ?? true} onCheckedChange={(v) => setF({ ...f, active: v })} />
          </div>
        </TabsContent>

        <TabsContent value="valores" className="space-y-3 pt-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Preço sugerido (R$)</Label>
              <Input type="number" step="0.01" value={(f.suggested_price_cents ?? 0) / 100}
                onChange={(e) => setF({ ...f, suggested_price_cents: toCents(e.target.value) })} /></div>
            <div><Label>Preço mínimo (R$)</Label>
              <Input type="number" step="0.01" value={(f.min_price_cents ?? 0) / 100}
                onChange={(e) => setF({ ...f, min_price_cents: toCents(e.target.value) })} /></div>
            <div><Label>Preço ideal (R$)</Label>
              <Input type="number" step="0.01" value={(f.ideal_price_cents ?? 0) / 100}
                onChange={(e) => setF({ ...f, ideal_price_cents: toCents(e.target.value) })} /></div>
            <div><Label>Preço padrão praticado (R$)</Label>
              <Input type="number" step="0.01" placeholder="Opcional"
                value={f.practiced_price_cents == null ? "" : f.practiced_price_cents / 100}
                onChange={(e) => setF({ ...f, practiced_price_cents: e.target.value === "" ? null : toCents(e.target.value) })} /></div>
            <div><Label>Preço promocional (R$)</Label>
              <Input type="number" step="0.01" placeholder="Opcional"
                value={f.promo_price_cents == null ? "" : f.promo_price_cents / 100}
                onChange={(e) => setF({ ...f, promo_price_cents: e.target.value === "" ? null : toCents(e.target.value) })} /></div>
            <div><Label>Margem desejada (%)</Label>
              <Input type="number" step="0.1" value={f.target_margin_pct ?? settings.default_margin_pct}
                onChange={(e) => setF({ ...f, target_margin_pct: parseFloat(e.target.value || "0") })} /></div>
          </div>

          <Card><CardContent className="p-4 space-y-2 text-sm">
            <p className="font-medium">Sugestão automática de preço</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                ["Mínimo", m.suggestion.min],
                ["Ideal", m.suggestion.ideal],
                ["Premium", m.suggestion.premium],
              ] as const).map(([label, v]) => (
                <button key={label} type="button"
                  className="rounded-md border p-3 text-left hover:bg-accent transition"
                  onClick={() => applyPrice(v)}>
                  <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
                  <p className="font-semibold">{brl(v)}</p>
                  <p className="text-[10px] text-muted-foreground">Aplicar como praticado</p>
                </button>
              ))}
            </div>
          </CardContent></Card>

          <div className="flex items-center justify-between">
            <div>
              <Label>Bloquear salvamento abaixo do custo</Label>
              <p className="text-xs text-muted-foreground">Impede cadastrar preço menor que o custo total.</p>
            </div>
            <Switch checked={f.block_below_cost !== false}
              onCheckedChange={(v) => setF({ ...f, block_below_cost: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Aplicar rateio de custos operacionais</Label>
              <p className="text-xs text-muted-foreground">Usa os custos fixos configurados em Custeio.</p>
            </div>
            <Switch checked={f.apply_overhead !== false}
              onCheckedChange={(v) => setF({ ...f, apply_overhead: v })} />
          </div>
          {edit && <StaffPrices procedureId={edit.id} companyId={edit.company_id} />}
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
              Nenhum insumo. Adicione os produtos do Estoque de Atendimento consumidos aqui.
            </p>
          ) : items.map((it, idx) => {
            const prod = products.find((p) => p.id === it.product_id);
            const factor = conversionFactor(it.consumption_unit ?? it.unit, it.purchase_unit ?? it.unit, conversions);
            return (
              <Card key={idx}>
                <CardContent className="p-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Produto (Estoque de Atendimento)</Label>
                      <Select value={it.product_id ?? ""} onValueChange={(v) => pickProduct(idx, v)}>
                        <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {prod && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Saldo {Number(prod.stock_qty ?? 0)} {prod.unit} · Médio {brl(Number(prod.avg_cost ?? 0))}
                          {prod.last_cost ? ` · Últ. ${brl(Number(prod.last_cost))}` : ""}
                          {prod.batch ? ` · Lote ${prod.batch}` : ""}
                          {prod.expires_on ? ` · Val. ${prod.expires_on}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label>Qtd</Label>
                        <Input type="number" step="0.001" value={it.quantity}
                          onChange={(e) => setItem(idx, { quantity: parseFloat(e.target.value || "0") })} /></div>
                      <div>
                        <Label>Un. consumo</Label>
                        <Select value={it.consumption_unit ?? it.unit}
                          onValueChange={(v) => setItem(idx, { consumption_unit: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Custo un. compra</Label>
                        <Input type="number" step="0.0001" value={it.unit_cost}
                          onChange={(e) => setItem(idx, { unit_cost: parseFloat(e.target.value || "0") })} /></div>
                    </div>
                  </div>

                  {factor == null ? (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Sem conversão entre {it.consumption_unit ?? it.unit} e {it.purchase_unit ?? it.unit}. Cadastre em Custeio → Conversões.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {Number(it.quantity) || 0} {it.consumption_unit ?? it.unit} ={" "}
                      {itemConvertedQty(it, conversions).toFixed(4)} {it.purchase_unit ?? it.unit} ·{" "}
                      <span className="font-medium text-foreground">{brl(itemCost(it, conversions))}</span>
                    </p>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2 items-end">
                    <div><Label>Observações</Label>
                      <Input value={it.notes ?? ""} placeholder="Opcional"
                        onChange={(e) => setItem(idx, { notes: e.target.value })} /></div>
                    <div className="flex justify-end">
                      <Button size="icon" variant="ghost"
                        onClick={() => setItems((s) => s.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

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
            <div><Label>Outros custos deste procedimento (R$)</Label>
              <Input type="number" step="0.01" value={(f.other_costs_cents ?? 0) / 100}
                onChange={(e) => setF({ ...f, other_costs_cents: toCents(e.target.value) })} /></div>
            <p className="text-xs text-muted-foreground">
              Rateio dos custos fixos da empresa neste procedimento: <strong>{brl(m.overheadCost)}</strong>
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Custos operacionais específicos</p>
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

        <TabsContent value="simulador" className="space-y-4 pt-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium flex items-center gap-2">
                <FlaskConical className="h-4 w-4" /> Simulador
              </p>
              <p className="text-xs text-muted-foreground">
                Teste cenários sem alterar os dados oficiais.
              </p>
            </div>
            <Switch checked={simOn} onCheckedChange={setSimOn} />
          </div>

          {simOn && (
            <div className="space-y-4">
              <SimSlider label="Quantidade de insumos" suffix="x" min={0.1} max={3} step={0.1}
                value={sim.qtyFactor} onChange={(v) => setSim({ ...sim, qtyFactor: v })} />
              <SimSlider label="Valor dos produtos" suffix="x" min={0.1} max={3} step={0.1}
                value={sim.costFactor} onChange={(v) => setSim({ ...sim, costFactor: v })} />
              <SimSlider label="Custos operacionais" suffix="x" min={0} max={3} step={0.1}
                value={sim.operational} onChange={(v) => setSim({ ...sim, operational: v })} />
              <div className="grid gap-3 sm:grid-cols-3">
                <div><Label>Comissão</Label>
                  <Input type="number" step="0.01" value={sim.commission}
                    onChange={(e) => setSim({ ...sim, commission: parseFloat(e.target.value || "0") })} /></div>
                <div><Label>Tempo (min)</Label>
                  <Input type="number" value={sim.duration}
                    onChange={(e) => setSim({ ...sim, duration: parseInt(e.target.value || "0") })} /></div>
                <div><Label>Margem desejada (%)</Label>
                  <Input type="number" step="0.1" value={sim.margin}
                    onChange={(e) => setSim({ ...sim, margin: parseFloat(e.target.value || "0") })} /></div>
              </div>

              <Card><CardContent className="p-5 space-y-2 text-sm">
                <Row label="Custo dos produtos" value={brl(simMath.productsCost)} />
                <Row label="Mão de obra" value={brl(simMath.laborCost)} />
                <Row label="Comissão" value={brl(simMath.commissionCost)} />
                <Row label="Operacionais + rateio" value={brl(simMath.operationalCost + simMath.overheadCost)} />
                <Separator />
                <Row label="Custo total" value={brl(simMath.totalCost)} strong />
                <Row label="Lucro líquido" value={brl(simMath.netProfit)} strong
                  className={simMath.netProfit >= 0 ? "text-emerald-600" : "text-red-600"} />
                <Row label="Margem" value={pct(simMath.marginPct)} />
                <Row label="Preço ideal sugerido" value={brl(simMath.suggestion.ideal)} />
              </CardContent></Card>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm"
                  onClick={() => applyPrice(simMath.suggestion.ideal)}>
                  Aplicar preço sugerido
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  setItems(simItems); setCosts(simCosts);
                  if (sim.duration) setF({ ...f, duration_min: sim.duration });
                  if (sim.commission) setF((p: any) => ({ ...p, commission_value: sim.commission }));
                  toast.success("Simulação aplicada ao formulário");
                }}>
                  Aplicar simulação
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="resumo" className="pt-3 space-y-3">
          <Card><CardContent className="p-5 space-y-2 text-sm">
            <Row label="Preço praticado" value={brl(m.price)} />
            <Row label="Custo dos produtos" value={brl(m.productsCost)} />
            <Row label="Custo da mão de obra" value={brl(m.laborCost)} />
            <Row label="Comissão" value={brl(m.commissionCost)} />
            <Row label="Custos operacionais" value={brl(m.operationalCost)} />
            <Row label="Rateio de custos fixos" value={brl(m.overheadCost)} />
            <Separator />
            <Row label="Custo total" value={brl(m.totalCost)} strong />
            <Row label="Lucro bruto" value={brl(m.grossProfit)} />
            <Row label="Lucro líquido" value={brl(m.netProfit)} strong
              className={m.netProfit >= 0 ? "text-emerald-600" : "text-red-600"} />
            <Row label="Percentual de lucro" value={pct(m.marginPct)} />
            <Row label="Percentual de custo" value={pct(m.costPct)} />
          </CardContent></Card>

          {alerts.length > 0 && (
            <Card className="border-amber-500/40"><CardContent className="p-4 space-y-1 text-xs">
              {alerts.map((a, i) => (
                <p key={i} className={`flex items-start gap-1 ${a.level === "danger" ? "text-red-600" : "text-amber-600"}`}>
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {a.message}
                </p>
              ))}
            </CardContent></Card>
          )}

          {edit && <VersionsList procedureId={edit.id} />}
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button onClick={submit} disabled={loading}>Salvar procedimento</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function SimSlider({ label, value, onChange, min, max, step, suffix = "" }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; suffix?: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <Label>{label}</Label>
        <span className="text-muted-foreground">{value.toFixed(1)}{suffix}</span>
      </div>
      <Slider className="mt-2" min={min} max={max} step={step} value={[value]}
        onValueChange={(v) => onChange(v[0] ?? min)} />
    </div>
  );
}

function StaffPrices({ procedureId, companyId }: { procedureId: string; companyId: string }) {
  const qc = useQueryClient();
  const { data: staff = [] } = useQuery({
    queryKey: ["staff-min", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("staff").select("id, name").eq("company_id", companyId).order("name");
      return data ?? [];
    },
  });
  const { data: prices = [] } = useQuery({
    queryKey: ["procedure-staff-prices", procedureId],
    queryFn: async () => {
      const { data } = await supabase.from("procedure_staff_prices").select("*").eq("procedure_id", procedureId);
      return data ?? [];
    },
  });
  const upsert = useMutation({
    mutationFn: async (p: { staff_id: string; price_cents: number }) => {
      const { error } = await supabase.from("procedure_staff_prices").upsert({
        company_id: companyId, procedure_id: procedureId, staff_id: p.staff_id, price_cents: p.price_cents,
      } as any, { onConflict: "procedure_id,staff_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procedure-staff-prices", procedureId] }),
    onError: (e: any) => toast.error(e.message),
  });

  if (!staff.length) return null;
  return (
    <Card><CardContent className="p-4 space-y-2">
      <p className="text-sm font-medium">Preço por profissional (opcional)</p>
      {staff.map((s: any) => {
        const cur = (prices as any[]).find((p) => p.staff_id === s.id);
        return (
          <div key={s.id} className="flex items-center gap-2">
            <span className="flex-1 text-sm truncate">{s.name}</span>
            <Input type="number" step="0.01" className="w-32"
              defaultValue={cur ? cur.price_cents / 100 : ""}
              placeholder="Padrão"
              onBlur={(e) => {
                if (e.target.value === "") return;
                upsert.mutate({ staff_id: s.id, price_cents: toCents(e.target.value) });
              }} />
          </div>
        );
      })}
    </CardContent></Card>
  );
}

function VersionsList({ procedureId }: { procedureId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["procedure-versions", procedureId],
    queryFn: async () => {
      const { data } = await supabase.from("procedure_versions")
        .select("*").eq("procedure_id", procedureId).order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
  });
  if (!data.length) return null;
  return (
    <Card><CardContent className="p-4 space-y-2">
      <p className="text-sm font-medium">Histórico de versões</p>
      <ul className="space-y-1 text-xs">
        {(data as any[]).map((v) => (
          <li key={v.id} className="flex justify-between gap-2 border-b last:border-0 pb-1">
            <span>v{v.version} · {new Date(v.created_at).toLocaleString("pt-BR")}</span>
            <span className="text-muted-foreground">
              Custo {brl(Number(v.totals?.totalCost ?? 0))} · Preço {brl(Number(v.totals?.price ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </CardContent></Card>
  );
}

function CostingSettingsDialog({ companyId, settings, overheads, conversions, products }: {
  companyId: string;
  settings: CostingSettings;
  overheads: OverheadCost[];
  conversions: UnitConversion[];
  products: ProductLite[];
}) {
  const qc = useQueryClient();
  const [s, setS] = useState<CostingSettings>(settings);
  const [list, setList] = useState<OverheadCost[]>(overheads);
  const [convs, setConvs] = useState<UnitConversion[]>(conversions);

  const saveAll = useMutation({
    mutationFn: async () => {
      const { error: e1 } = await supabase.from("costing_settings").upsert({
        company_id: companyId,
        allocation_basis: s.allocation_basis,
        monthly_hours: s.monthly_hours,
        monthly_appointments: s.monthly_appointments,
        default_margin_pct: s.default_margin_pct,
        min_margin_pct: s.min_margin_pct,
        block_below_cost: s.block_below_cost,
      } as any, { onConflict: "company_id" });
      if (e1) throw e1;

      await supabase.from("overhead_costs").delete().eq("company_id", companyId);
      const valid = list.filter((o) => o.label.trim());
      if (valid.length) {
        const { error } = await supabase.from("overhead_costs").insert(
          valid.map((o) => ({
            company_id: companyId, label: o.label.trim(),
            monthly_cents: Number(o.monthly_cents) || 0, include_in_costing: o.include_in_costing,
          })) as any,
        );
        if (error) throw error;
      }

      await supabase.from("unit_conversions").delete().eq("company_id", companyId);
      const validConv = convs.filter((c) => c.from_unit.trim() && c.to_unit.trim() && Number(c.factor) > 0);
      if (validConv.length) {
        const { error } = await supabase.from("unit_conversions").insert(
          validConv.map((c) => ({
            company_id: companyId, from_unit: c.from_unit.trim(),
            to_unit: c.to_unit.trim(), factor: Number(c.factor),
          })) as any,
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configuração de custeio salva");
      qc.invalidateQueries({ queryKey: ["costing-settings", companyId] });
      qc.invalidateQueries({ queryKey: ["overhead-costs", companyId] });
      qc.invalidateQueries({ queryKey: ["unit-conversions", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const monthlyTotal = list.filter((o) => o.include_in_costing)
    .reduce((a, o) => a + (Number(o.monthly_cents) || 0), 0) / 100;

  return (
    <DialogContent className="sm:max-w-3xl max-h-[92dvh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
      <DialogHeader><DialogTitle>Configuração de custeio</DialogTitle></DialogHeader>

      <Tabs defaultValue="regras">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="regras">Regras</TabsTrigger>
          <TabsTrigger value="fixos">Custos fixos</TabsTrigger>
          <TabsTrigger value="conv">Conversões</TabsTrigger>
        </TabsList>

        <TabsContent value="regras" className="space-y-3 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Base de rateio</Label>
              <Select value={s.allocation_basis} onValueChange={(v) => setS({ ...s, allocation_basis: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hour">Por hora de atendimento</SelectItem>
                  <SelectItem value="appointment">Por atendimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Horas produtivas por mês</Label>
              <Input type="number" value={s.monthly_hours}
                onChange={(e) => setS({ ...s, monthly_hours: parseFloat(e.target.value || "0") })} /></div>
            <div><Label>Atendimentos por mês</Label>
              <Input type="number" value={s.monthly_appointments}
                onChange={(e) => setS({ ...s, monthly_appointments: parseInt(e.target.value || "0") })} /></div>
            <div><Label>Margem padrão desejada (%)</Label>
              <Input type="number" step="0.1" value={s.default_margin_pct}
                onChange={(e) => setS({ ...s, default_margin_pct: parseFloat(e.target.value || "0") })} /></div>
            <div><Label>Margem mínima aceitável (%)</Label>
              <Input type="number" step="0.1" value={s.min_margin_pct}
                onChange={(e) => setS({ ...s, min_margin_pct: parseFloat(e.target.value || "0") })} /></div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Bloquear preços abaixo do custo (padrão)</Label>
            <Switch checked={s.block_below_cost} onCheckedChange={(v) => setS({ ...s, block_below_cost: v })} />
          </div>
        </TabsContent>

        <TabsContent value="fixos" className="space-y-3 pt-3">
          <div className="flex flex-wrap gap-1">
            {COST_PRESETS.map((p) => (
              <Button key={p} size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => setList((x) => [...x, { label: p, monthly_cents: 0, include_in_costing: true }])}>
                + {p}
              </Button>
            ))}
          </div>
          {list.map((o, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input value={o.label} placeholder="Custo"
                onChange={(e) => setList((x) => x.map((v, i) => i === idx ? { ...v, label: e.target.value } : v))} />
              <Input type="number" step="0.01" className="w-32" value={o.monthly_cents / 100}
                onChange={(e) => setList((x) => x.map((v, i) => i === idx ? { ...v, monthly_cents: toCents(e.target.value) } : v))} />
              <Switch checked={o.include_in_costing}
                onCheckedChange={(v) => setList((x) => x.map((c, i) => i === idx ? { ...c, include_in_costing: v } : c))} />
              <Button size="icon" variant="ghost" onClick={() => setList((x) => x.filter((_, i) => i !== idx))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <p className="text-sm text-muted-foreground">
            Total mensal considerado: <strong>{brl(monthlyTotal)}</strong>
          </p>
        </TabsContent>

        <TabsContent value="conv" className="space-y-3 pt-3">
          <p className="text-xs text-muted-foreground">
            Informe quanto cada embalagem rende. Ex.: 1 caixa = 100 un, 1 frasco = 240 ml.
            Conversões métricas (l/ml, kg/g, m/cm) já são automáticas.
          </p>
          <div className="flex flex-wrap gap-1">
            {SUGGESTED_CUSTOM.map((c) => (
              <Button key={`${c.from_unit}-${c.to_unit}`} size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => setConvs((x) => [...x, { from_unit: c.from_unit, to_unit: c.to_unit, factor: 1 }])}>
                + 1 {c.from_unit} = ? {c.to_unit}
              </Button>
            ))}
          </div>
          {convs.map((c, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <span>1</span>
              <Input className="w-28" value={c.from_unit}
                onChange={(e) => setConvs((x) => x.map((v, i) => i === idx ? { ...v, from_unit: e.target.value } : v))} />
              <span>=</span>
              <Input className="w-24" type="number" step="0.0001" value={c.factor}
                onChange={(e) => setConvs((x) => x.map((v, i) => i === idx ? { ...v, factor: parseFloat(e.target.value || "0") } : v))} />
              <Input className="w-28" value={c.to_unit}
                onChange={(e) => setConvs((x) => x.map((v, i) => i === idx ? { ...v, to_unit: e.target.value } : v))} />
              <Button size="icon" variant="ghost" onClick={() => setConvs((x) => x.filter((_, i) => i !== idx))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {products.some((p) => !p.unit) && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Existem produtos sem unidade cadastrada no estoque.
            </p>
          )}
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button onClick={() => saveAll.mutate()} disabled={saveAll.isPending}>Salvar configuração</Button>
      </DialogFooter>
    </DialogContent>
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
      <DialogHeader><DialogTitle>Auditoria de procedimentos</DialogTitle></DialogHeader>
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
      ) : !data.length ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nenhum registro.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {(data as any[]).map((l) => (
            <li key={l.id} className="border-b pb-2 last:border-0">
              <div className="flex justify-between gap-2">
                <span className="font-medium truncate">{l.procedure_name ?? "—"}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(l.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {entityLabel[l.entity] ?? l.entity} · {actionLabel[l.action] ?? l.action}
              </p>
            </li>
          ))}
        </ul>
      )}
    </DialogContent>
  );
}
