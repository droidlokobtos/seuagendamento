import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Package, ArrowDownUp, AlertTriangle } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/products")({
  component: Products,
});

type P = {
  id: string; name: string; sku: string | null; brand: string | null;
  unit: string; cost_price: number; sale_price: number;
  stock_qty: number; min_stock: number; active: boolean; notes: string | null;
};

function Products() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const [edit, setEdit] = useState<P | null>(null);
  const [open, setOpen] = useState(false);
  const [move, setMove] = useState<P | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["products", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*")
        .eq("company_id", companyId).order("name");
      if (error) throw error;
      return (data ?? []) as P[];
    },
  });

  const save = useMutation({
    mutationFn: async (v: Partial<P>) => {
      if (edit) {
        const { error } = await supabase.from("products").update(v).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { stock_qty, ...rest } = v;
        const { data: created, error } = await supabase.from("products")
          .insert({ ...rest, stock_qty: 0, company_id: companyId } as any).select().single();
        if (error) throw error;
        if (stock_qty && stock_qty > 0) {
          await supabase.from("inventory_movements").insert({
            company_id: companyId, product_id: created.id,
            type: "in", quantity: stock_qty, reason: "Estoque inicial",
          } as any);
        }
      }
    },
    onSuccess: () => {
      toast.success(edit ? "Produto atualizado" : "Produto criado");
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      setOpen(false); setEdit(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["products", companyId] });
    },
  });

  const moveMut = useMutation({
    mutationFn: async (v: { type: "in" | "out" | "adjustment"; quantity: number; reason: string }) => {
      if (!move) return;
      const { error } = await supabase.from("inventory_movements").insert({
        company_id: companyId, product_id: move.id, ...v,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimento registrado");
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      setMove(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Estoque</h1>
          <p className="text-sm text-muted-foreground">Produtos e movimentações.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEdit(null)}><Plus className="h-4 w-4 mr-2" /> Novo produto</Button>
          </DialogTrigger>
          <ProductDialog edit={edit} onSave={(v) => save.mutate(v)} loading={save.isPending} />
        </Dialog>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : !data.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => {
            const low = Number(p.stock_qty) <= Number(p.min_stock);
            return (
              <Card key={p.id} className={!p.active ? "opacity-60" : ""}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[p.brand, p.sku].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
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
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Estoque</p>
                      <p className="font-semibold flex items-center gap-1">
                        {Number(p.stock_qty)} {p.unit}
                        {low && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-xs">Venda</p>
                      <p className="font-semibold">{brl(Number(p.sale_price))}</p>
                    </div>
                  </div>
                  {low && <Badge variant="outline" className="text-amber-600 border-amber-500/30">Estoque baixo</Badge>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!move} onOpenChange={(o) => { if (!o) setMove(null); }}>
        {move && <MoveDialog product={move} onSave={(v) => moveMut.mutate(v)} loading={moveMut.isPending} />}
      </Dialog>
    </div>
  );
}

function ProductDialog({ edit, onSave, loading }: {
  edit: P | null; onSave: (v: Partial<P>) => void; loading: boolean;
}) {
  const [f, setF] = useState<Partial<P>>(
    edit ?? { name: "", unit: "un", cost_price: 0, sale_price: 0, stock_qty: 0, min_stock: 0, active: true },
  );
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>{edit ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Nome</Label>
          <Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Marca</Label>
            <Input value={f.brand ?? ""} onChange={(e) => setF({ ...f, brand: e.target.value })} /></div>
          <div><Label>SKU</Label>
            <Input value={f.sku ?? ""} onChange={(e) => setF({ ...f, sku: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Unidade</Label>
            <Input value={f.unit ?? "un"} onChange={(e) => setF({ ...f, unit: e.target.value })} /></div>
          <div><Label>Custo (R$)</Label>
            <Input type="number" step="0.01" value={f.cost_price ?? 0}
              onChange={(e) => setF({ ...f, cost_price: parseFloat(e.target.value || "0") })} /></div>
          <div><Label>Venda (R$)</Label>
            <Input type="number" step="0.01" value={f.sale_price ?? 0}
              onChange={(e) => setF({ ...f, sale_price: parseFloat(e.target.value || "0") })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {!edit && (
            <div><Label>Estoque inicial</Label>
              <Input type="number" step="0.001" value={f.stock_qty ?? 0}
                onChange={(e) => setF({ ...f, stock_qty: parseFloat(e.target.value || "0") })} /></div>
          )}
          <div><Label>Estoque mínimo</Label>
            <Input type="number" step="0.001" value={f.min_stock ?? 0}
              onChange={(e) => setF({ ...f, min_stock: parseFloat(e.target.value || "0") })} /></div>
        </div>
        <div><Label>Observações</Label>
          <Textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        <div className="flex items-center justify-between">
          <Label>Ativo</Label>
          <Switch checked={f.active ?? true} onCheckedChange={(v) => setF({ ...f, active: v })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(f)} disabled={loading || !f.name}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function MoveDialog({ product, onSave, loading }: {
  product: P;
  onSave: (v: { type: "in" | "out" | "adjustment"; quantity: number; reason: string }) => void;
  loading: boolean;
}) {
  const [type, setType] = useState<"in" | "out" | "adjustment">("in");
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState("");
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
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="in">Entrada</SelectItem>
              <SelectItem value="out">Saída</SelectItem>
              <SelectItem value="adjustment">Ajuste (definir total)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Quantidade</Label>
          <Input type="number" step="0.001" value={quantity}
            onChange={(e) => setQuantity(parseFloat(e.target.value || "0"))} />
        </div>
        <div>
          <Label>Motivo</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Compra, Uso, Perda" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave({ type, quantity, reason })} disabled={loading || !quantity}>
          Registrar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
