import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, Package, ArrowDownUp, AlertTriangle, Download, Search, History,
} from "lucide-react";
import { brl, dateBR } from "@/lib/format";
import {
  ALERT_LABEL, MOVEMENT_OPERATIONS, SCOPE_LABEL, downloadCSV, stockAlerts,
  type Product, type ProductScope,
} from "@/lib/commerce";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/products")({
  component: ProductsPage,
  head: () => ({
    meta: [
      { title: "Estoque de atendimento e vendas · Controle de produtos" },
      { name: "description", content: "Gerencie insumos de atendimento e produtos para venda, com entradas, inventário, alertas de validade e estoque mínimo." },
      { property: "og:title", content: "Estoque de atendimento e vendas" },
      { property: "og:description", content: "Controle completo de insumos e produtos para venda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Movement = {
  id: string; product_id: string; type: "in" | "out" | "adjustment";
  quantity: number; unit_cost: number | null; reason: string | null;
  operation: string | null; created_at: string;
};

function ProductsPage() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const [scope, setScope] = useState<ProductScope>("service");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [move, setMove] = useState<Product | null>(null);
  const [history, setHistory] = useState<Product | null>(null);

  const { data: all = [], isLoading } = useQuery({
    queryKey: ["products", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*")
        .eq("company_id", companyId).order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all
      .filter((p) => (p.scope ?? "service") === scope)
      .filter((p) => !term || [p.name, p.brand, p.sku, p.internal_code, p.barcode, p.category, p.supplier]
        .some((v) => (v ?? "").toLowerCase().includes(term)));
  }, [all, scope, q]);

  const alerts = useMemo(() => stockAlerts(list), [list]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["products", companyId] });

  const save = useMutation({
    mutationFn: async (v: Partial<Product> & { initial_qty?: number }) => {
      const { initial_qty, ...rest } = v;
      if (edit) {
        const { id, company_id, stock_qty, avg_cost, ...upd } = rest as any;
        const { error } = await supabase.from("products").update(upd).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { id, company_id, stock_qty, avg_cost, ...ins } = rest as any;
        const { data: created, error } = await supabase.from("products")
          .insert({ ...ins, scope, stock_qty: 0, company_id: companyId } as any).select().single();
        if (error) throw error;
        if (initial_qty && initial_qty > 0) {
          await supabase.from("inventory_movements").insert({
            company_id: companyId, product_id: created.id, type: "in",
            quantity: initial_qty, unit_cost: ins.cost_price || null,
            operation: "inventario", reason: "Estoque inicial",
          } as any);
        }
      }
    },
    onSuccess: () => {
      toast.success(edit ? "Produto atualizado" : "Produto criado");
      invalidate(); setOpen(false); setEdit(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const moveMut = useMutation({
    mutationFn: async (v: { type: "in" | "out" | "adjustment"; operation: string; quantity: number; unit_cost: number | null; reason: string }) => {
      if (!move) return;
      const { error } = await supabase.from("inventory_movements").insert({
        company_id: companyId, product_id: move.id, ...v,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Movimento registrado"); invalidate(); setMove(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const exportCSV = () => {
    downloadCSV(`estoque-${scope}-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Nome", "Código", "Cód. barras", "Categoria", "Marca", "Fornecedor", "Unidade",
        "Quantidade", "Mínimo", "Ideal", "Custo", "Médio", "Último", "Venda", "Local", "Lote", "Validade", "Status"],
      ...list.map((p) => [
        p.name, p.internal_code ?? p.sku ?? "", p.barcode ?? "", p.category ?? "", p.brand ?? "",
        p.supplier ?? "", p.unit, Number(p.stock_qty), Number(p.min_stock), Number(p.ideal_stock),
        Number(p.cost_price), Number(p.avg_cost), Number(p.last_cost ?? 0), Number(p.sale_price),
        p.location ?? "", p.batch ?? "", p.expires_on ?? "", p.active ? "Ativo" : "Inativo",
      ]),
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Estoque</h1>
          <p className="text-sm text-muted-foreground">
            Insumos de atendimento e produtos para venda, separados e integrados.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" /> Exportar
          </Button>
          <Button onClick={() => { setEdit(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo produto
          </Button>
        </div>
      </div>

      <Tabs value={scope} onValueChange={(v) => setScope(v as ProductScope)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="service" className="flex-1">Atendimento</TabsTrigger>
          <TabsTrigger value="sale" className="flex-1">Vendas</TabsTrigger>
        </TabsList>
        <TabsContent value={scope} className="space-y-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome, código, categoria, fornecedor…"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {alerts.length > 0 && (
            <Card className="border-amber-500/30">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas de estoque
                </p>
                <div className="flex flex-wrap gap-2">
                  {alerts.slice(0, 12).map((a, i) => (
                    <Badge key={i} variant="outline" className={ALERT_LABEL[a.kind].className}>
                      {a.product.name} · {ALERT_LABEL[a.kind].label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">Carregando…</CardContent></Card>
          ) : !list.length ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Package className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Nenhum produto no {SCOPE_LABEL[scope].toLowerCase()}.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => {
                const low = Number(p.stock_qty) <= Number(p.min_stock);
                return (
                  <Card key={p.id} className={!p.active ? "opacity-60" : ""}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[p.category, p.brand, p.internal_code ?? p.sku].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => setHistory(p)} title="Movimentações">
                            <History className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setMove(p)} title="Movimentar">
                            <ArrowDownUp className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { setEdit(p); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => confirm("Remover?") && del.mutate(p.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Estoque</p>
                          <p className="font-semibold flex items-center gap-1">
                            {Number(p.stock_qty)} {p.unit}
                            {low && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Custo médio</p>
                          <p className="font-semibold">{brl(Number(p.avg_cost || p.cost_price))}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground text-xs">{scope === "sale" ? "Venda" : "Compra"}</p>
                          <p className="font-semibold">
                            {brl(Number(scope === "sale" ? (p.promo_price || p.sale_price) : p.cost_price))}
                          </p>
                        </div>
                      </div>
                      {(p.location || p.batch || p.expires_on) && (
                        <p className="text-xs text-muted-foreground">
                          {[p.location, p.batch && `Lote ${p.batch}`, p.expires_on && `Val. ${dateBR(p.expires_on)}`]
                            .filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
        {open && (
          <ProductDialog key={edit?.id ?? "new"} edit={edit} scope={scope}
            onSave={(v) => save.mutate(v)} loading={save.isPending} />
        )}
      </Dialog>

      <Dialog open={!!move} onOpenChange={(o) => { if (!o) setMove(null); }}>
        {move && <MoveDialog product={move} onSave={(v) => moveMut.mutate(v)} loading={moveMut.isPending} />}
      </Dialog>

      <Dialog open={!!history} onOpenChange={(o) => { if (!o) setHistory(null); }}>
        {history && <HistoryDialog product={history} companyId={companyId} />}
      </Dialog>
    </div>
  );
}

function ProductDialog({ edit, scope, onSave, loading }: {
  edit: Product | null; scope: ProductScope;
  onSave: (v: Partial<Product> & { initial_qty?: number }) => void; loading: boolean;
}) {
  const [f, setF] = useState<Partial<Product> & { initial_qty?: number }>(
    edit ?? {
      name: "", unit: "un", cost_price: 0, sale_price: 0, min_stock: 0, ideal_stock: 0,
      active: true, scope, initial_qty: 0,
    },
  );
  const set = (v: Partial<Product> & { initial_qty?: number }) => setF({ ...f, ...v });
  const num = (v: string) => parseFloat(v || "0") || 0;

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{edit ? "Editar produto" : "Novo produto"}</DialogTitle>
        <p className="text-sm text-muted-foreground">{SCOPE_LABEL[(f.scope as ProductScope) ?? scope]}</p>
      </DialogHeader>
      <div className="space-y-3">
        <div><Label>Nome</Label>
          <Input value={f.name ?? ""} onChange={(e) => set({ name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Código interno</Label>
            <Input value={f.internal_code ?? ""} onChange={(e) => set({ internal_code: e.target.value })} /></div>
          <div><Label>Código de barras</Label>
            <Input value={f.barcode ?? ""} onChange={(e) => set({ barcode: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Categoria</Label>
            <Input value={f.category ?? ""} onChange={(e) => set({ category: e.target.value })} /></div>
          <div><Label>Marca</Label>
            <Input value={f.brand ?? ""} onChange={(e) => set({ brand: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Fornecedor</Label>
            <Input value={f.supplier ?? ""} onChange={(e) => set({ supplier: e.target.value })} /></div>
          <div><Label>Unidade</Label>
            <Input value={f.unit ?? "un"} onChange={(e) => set({ unit: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {!edit && (
            <div><Label>Qtd. atual</Label>
              <Input type="number" step="0.001" value={f.initial_qty ?? 0}
                onChange={(e) => set({ initial_qty: num(e.target.value) })} /></div>
          )}
          <div><Label>Mínimo</Label>
            <Input type="number" step="0.001" value={f.min_stock ?? 0}
              onChange={(e) => set({ min_stock: num(e.target.value) })} /></div>
          <div><Label>Ideal</Label>
            <Input type="number" step="0.001" value={f.ideal_stock ?? 0}
              onChange={(e) => set({ ideal_stock: num(e.target.value) })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Compra (R$)</Label>
            <Input type="number" step="0.01" value={f.cost_price ?? 0}
              onChange={(e) => set({ cost_price: num(e.target.value) })} /></div>
          <div>
            <Label>Médio (R$)</Label>
            <Input disabled value={Number(f.avg_cost ?? 0).toFixed(2)} />
          </div>
          <div>
            <Label>Último (R$)</Label>
            <Input disabled value={Number(f.last_cost ?? 0).toFixed(2)} />
          </div>
        </div>
        {((f.scope as ProductScope) ?? scope) === "sale" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Venda (R$)</Label>
                <Input type="number" step="0.01" value={f.sale_price ?? 0}
                  onChange={(e) => set({ sale_price: num(e.target.value) })} /></div>
              <div><Label>Promocional (R$)</Label>
                <Input type="number" step="0.01" value={f.promo_price ?? 0}
                  onChange={(e) => set({ promo_price: num(e.target.value) })} /></div>
            </div>
            <div>
              <Label>Imagem</Label>
              <ImageUpload value={f.image_url ?? ""} onChange={(url) => set({ image_url: url })} />
            </div>
          </>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Localização</Label>
            <Input value={f.location ?? ""} onChange={(e) => set({ location: e.target.value })} /></div>
          <div><Label>Lote</Label>
            <Input value={f.batch ?? ""} onChange={(e) => set({ batch: e.target.value })} /></div>
          <div><Label>Validade</Label>
            <Input type="date" value={f.expires_on ?? ""} onChange={(e) => set({ expires_on: e.target.value || null })} /></div>
        </div>
        <div><Label>Observações</Label>
          <Textarea value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></div>
        <div className="flex items-center justify-between">
          <Label>Ativo</Label>
          <Switch checked={f.active ?? true} onCheckedChange={(v) => set({ active: v })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(f)} disabled={loading || !f.name}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function MoveDialog({ product, onSave, loading }: {
  product: Product;
  onSave: (v: { type: "in" | "out" | "adjustment"; operation: string; quantity: number; unit_cost: number | null; reason: string }) => void;
  loading: boolean;
}) {
  const [operation, setOperation] = useState("compra");
  const [type, setType] = useState<"in" | "out" | "adjustment">("in");
  const [quantity, setQuantity] = useState(0);
  const [unitCost, setUnitCost] = useState<number>(Number(product.cost_price) || 0);
  const [reason, setReason] = useState("");

  const pick = (op: string) => {
    setOperation(op);
    setType(op === "compra" ? "in" : op === "inventario" ? "adjustment" : op === "transferencia" ? "out" : "adjustment");
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Movimentar estoque</DialogTitle>
        <p className="text-sm text-muted-foreground">
          {product.name} · atual: {Number(product.stock_qty)} {product.unit}
        </p>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Operação</Label>
          <Select value={operation} onValueChange={pick}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOVEMENT_OPERATIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Efeito no estoque</Label>
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="in">Entrada (+)</SelectItem>
              <SelectItem value="out">Saída (−)</SelectItem>
              <SelectItem value="adjustment">Ajuste (definir total)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Quantidade</Label>
            <Input type="number" step="0.001" value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value || "0"))} />
          </div>
          <div>
            <Label>Valor unitário (R$)</Label>
            <Input type="number" step="0.01" value={unitCost}
              onChange={(e) => setUnitCost(parseFloat(e.target.value || "0"))} />
          </div>
        </div>
        <div>
          <Label>Observação</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: NF 1234, fornecedor X" />
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() => onSave({ type, operation, quantity, unit_cost: unitCost || null, reason: reason || MOVEMENT_OPERATIONS.find((o) => o.value === operation)!.label })}
          disabled={loading || !quantity}
        >
          Registrar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function HistoryDialog({ product, companyId }: { product: Product; companyId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["movements", companyId, product.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_movements")
        .select("*").eq("product_id", product.id)
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Movement[];
    },
  });

  return (
    <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Movimentações</DialogTitle>
        <p className="text-sm text-muted-foreground">{product.name}</p>
      </DialogHeader>
      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : !data.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sem movimentações.</p>
      ) : (
        <div className="divide-y">
          {data.map((m) => (
            <div key={m.id} className="py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{m.reason || m.operation || "Movimento"}</p>
                <p className="text-xs text-muted-foreground">{dateBR(m.created_at)}</p>
              </div>
              <span className={`text-sm font-semibold ${m.type === "in" ? "text-emerald-600" : m.type === "out" ? "text-rose-600" : ""}`}>
                {m.type === "in" ? "+" : m.type === "out" ? "−" : "="} {Number(m.quantity)} {product.unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </DialogContent>
  );
}
