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
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ShoppingCart, Download, Search, Receipt } from "lucide-react";
import { dateBR } from "@/lib/format";
import {
  downloadCSV, effectivePriceCents, itemTotal, money, saleTotals, toCents,
  type Product, type SaleItem, type SalePayment,
} from "@/lib/commerce";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/sales")({
  component: SalesPage,
  head: () => ({
    meta: [
      { title: "Vendas e PDV · Produtos e serviços avulsos" },
      { name: "description", content: "Registre vendas de produtos e serviços avulsos com múltiplas formas de pagamento, baixa automática de estoque e lançamento financeiro." },
      { property: "og:title", content: "Vendas e PDV" },
      { property: "og:description", content: "Registro de vendas com baixa de estoque e integração financeira." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Sale = {
  id: string; status: string; customer_id: string | null; staff_id: string | null;
  subtotal_cents: number; discount_cents: number; surcharge_cents: number;
  total_cents: number; notes: string | null; occurred_at: string;
};

function SalesPage() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const from = `${month}-01T00:00:00`;
  const to = new Date(new Date(`${month}-01`).getFullYear(), new Date(`${month}-01`).getMonth() + 1, 1)
    .toISOString();

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales", companyId, month],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*")
        .eq("company_id", companyId).gte("occurred_at", from).lt("occurred_at", to)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Sale[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*")
        .eq("company_id", companyId).eq("active", true).order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services-simple", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("services")
        .select("id,name,price").eq("company_id", companyId).eq("active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-simple", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers")
        .select("id,name").eq("company_id", companyId).order("name").limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: options = [] } = useQuery({
    queryKey: ["payment_options", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_options")
        .select("id,name").eq("company_id", companyId).eq("active", true).order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const done = sales.filter((s) => s.status === "completed");
    return {
      count: done.length,
      revenue: done.reduce((s, x) => s + x.total_cents, 0),
      ticket: done.length ? Math.round(done.reduce((s, x) => s + x.total_cents, 0) / done.length) : 0,
    };
  }, [sales]);

  const create = useMutation({
    mutationFn: async (v: {
      items: SaleItem[]; payments: SalePayment[]; customer_id: string | null;
      discount_cents: number; surcharge_cents: number; notes: string;
    }) => {
      const { subtotal, total } = saleTotals(v.items, v.discount_cents, v.surcharge_cents);
      const { data: sale, error } = await supabase.from("sales").insert({
        company_id: companyId, customer_id: v.customer_id, status: "draft",
        subtotal_cents: subtotal, discount_cents: v.discount_cents,
        surcharge_cents: v.surcharge_cents, total_cents: total,
        services_cents: v.items.filter((i) => i.kind === "service").reduce((s, i) => s + itemTotal(i), 0),
        notes: v.notes || null,
      } as any).select().single();
      if (error) throw error;

      const { error: e2 } = await supabase.from("sale_items").insert(
        v.items.map((i) => ({
          company_id: companyId, sale_id: sale.id, product_id: i.product_id,
          service_id: i.service_id ?? null, kind: i.kind, name: i.name,
          quantity: i.quantity, unit_price_cents: i.unit_price_cents,
          discount_cents: i.discount_cents, total_cents: itemTotal(i), unit_cost: i.unit_cost ?? null,
        })) as any,
      );
      if (e2) throw e2;

      if (v.payments.length) {
        const { error: e3 } = await supabase.from("sale_payments").insert(
          v.payments.map((p) => ({ company_id: companyId, sale_id: sale.id, ...p })) as any,
        );
        if (e3) throw e3;
      }

      const { error: e4 } = await supabase.from("sales")
        .update({ status: "completed" }).eq("id", sale.id);
      if (e4) throw e4;
    },
    onSuccess: () => {
      toast.success("Venda registrada");
      qc.invalidateQueries({ queryKey: ["sales", companyId] });
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      qc.invalidateQueries({ queryKey: ["finances", companyId] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda cancelada");
      qc.invalidateQueries({ queryKey: ["sales", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const exportCSV = () => {
    downloadCSV(`vendas-${month}.csv`, [
      ["Data", "Status", "Subtotal", "Desconto", "Acréscimo", "Total"],
      ...sales.map((s) => [
        dateBR(s.occurred_at), s.status, money(s.subtotal_cents),
        money(s.discount_cents), money(s.surcharge_cents), money(s.total_cents),
      ]),
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Vendas</h1>
          <p className="text-sm text-muted-foreground">
            Produtos e serviços avulsos com baixa de estoque e lançamento financeiro automáticos.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Exportar</Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Nova venda</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Kpi label="Vendas no mês" value={String(totals.count)} icon={<ShoppingCart className="h-5 w-5" />} />
        <Kpi label="Faturamento" value={money(totals.revenue)} icon={<Receipt className="h-5 w-5" />} tone="text-emerald-600" />
        <Kpi label="Ticket médio" value={money(totals.ticket)} icon={<Receipt className="h-5 w-5" />} tone="text-primary" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Carregando…</div>
          ) : !sales.length ? (
            <div className="p-12 text-center text-muted-foreground">Sem vendas neste mês.</div>
          ) : (
            <div className="divide-y">
              {sales.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {money(s.total_cents)}
                      {s.discount_cents > 0 && (
                        <span className="text-xs text-muted-foreground"> · desc. {money(s.discount_cents)}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {dateBR(s.occurred_at)}{s.notes ? ` · ${s.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={
                      s.status === "completed" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : s.status === "cancelled" ? "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300" : ""
                    }>
                      {s.status === "completed" ? "Concluída" : s.status === "cancelled" ? "Cancelada" : "Rascunho"}
                    </Badge>
                    {s.status === "completed" && (
                      <Button size="icon" variant="ghost" onClick={() => confirm("Cancelar venda?") && cancel.mutate(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <SaleDialog
            products={products as Product[]}
            services={services as any[]}
            customers={customers as any[]}
            options={options as any[]}
            loading={create.isPending}
            onSave={(v) => create.mutate(v)}
          />
        )}
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, icon, tone = "text-foreground" }: {
  label: string; value: string; icon: React.ReactNode; tone?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className={tone}>{icon}</span>
        </div>
        <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function SaleDialog({ products, services, customers, options, onSave, loading }: {
  products: Product[]; services: any[]; customers: any[]; options: any[];
  loading: boolean;
  onSave: (v: {
    items: SaleItem[]; payments: SalePayment[]; customer_id: string | null;
    discount_cents: number; surcharge_cents: number; notes: string;
  }) => void;
}) {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [payments, setPayments] = useState<SalePayment[]>([]);
  const [customer, setCustomer] = useState<string>("");
  const [discount, setDiscount] = useState(0);
  const [surcharge, setSurcharge] = useState(0);
  const [notes, setNotes] = useState("");
  const [q, setQ] = useState("");

  const sellable = useMemo(
    () => products.filter((p) => (p.scope ?? "sale") === "sale"),
    [products],
  );
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return [
      ...sellable.filter((p) => [p.name, p.barcode, p.sku, p.internal_code]
        .some((v) => (v ?? "").toLowerCase().includes(t))).slice(0, 6)
        .map((p) => ({ kind: "product" as const, id: p.id, name: p.name, cents: effectivePriceCents(p), cost: Number(p.avg_cost || p.cost_price) })),
      ...services.filter((s) => (s.name ?? "").toLowerCase().includes(t)).slice(0, 6)
        .map((s) => ({ kind: "service" as const, id: s.id, name: s.name, cents: toCents(s.price), cost: 0 })),
    ];
  }, [q, sellable, services]);

  const add = (r: { kind: "product" | "service"; id: string; name: string; cents: number; cost: number }) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => (r.kind === "product" ? x.product_id : x.service_id) === r.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, {
        kind: r.kind,
        product_id: r.kind === "product" ? r.id : null,
        service_id: r.kind === "service" ? r.id : null,
        name: r.name, quantity: 1, unit_price_cents: r.cents,
        discount_cents: 0, total_cents: r.cents, unit_cost: r.cost,
      }];
    });
    setQ("");
  };

  const { subtotal, total } = saleTotals(items, toCents(discount), toCents(surcharge));
  const paid = payments.reduce((s, p) => s + p.amount_cents, 0);
  const remaining = total - paid;

  const addPayment = () => {
    const opt = options[0];
    setPayments([...payments, {
      payment_option_id: opt?.id ?? null,
      method_name: opt?.name ?? "Dinheiro",
      amount_cents: Math.max(0, remaining),
      installments: 1,
    }]);
  };

  return (
    <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Nova venda</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Cliente (opcional)</Label>
          <Select value={customer} onValueChange={setCustomer}>
            <SelectTrigger><SelectValue placeholder="Consumidor final" /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Adicionar item</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar produto ou serviço…" value={q}
              onChange={(e) => setQ(e.target.value)} />
          </div>
          {results.length > 0 && (
            <div className="mt-1 rounded-md border divide-y">
              {results.map((r) => (
                <button key={`${r.kind}-${r.id}`} type="button" onClick={() => add(r)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left">
                  <span className="truncate">{r.name}
                    <span className="text-xs text-muted-foreground"> · {r.kind === "product" ? "Produto" : "Serviço"}</span>
                  </span>
                  <span className="font-medium shrink-0">{money(r.cents)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="rounded-md border divide-y">
            {items.map((i, idx) => (
              <div key={idx} className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{i.name}</p>
                  <Button size="icon" variant="ghost"
                    onClick={() => setItems(items.filter((_, k) => k !== idx))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Qtd</Label>
                    <Input type="number" step="0.001" value={i.quantity}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...i, quantity: parseFloat(e.target.value || "0") };
                        setItems(next);
                      }} />
                  </div>
                  <div>
                    <Label className="text-xs">Unit. (R$)</Label>
                    <Input type="number" step="0.01" value={(i.unit_price_cents / 100).toFixed(2)}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...i, unit_price_cents: toCents(e.target.value) };
                        setItems(next);
                      }} />
                  </div>
                  <div>
                    <Label className="text-xs">Desc. (R$)</Label>
                    <Input type="number" step="0.01" value={(i.discount_cents / 100).toFixed(2)}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...i, discount_cents: toCents(e.target.value) };
                        setItems(next);
                      }} />
                  </div>
                </div>
                <p className="text-xs text-right text-muted-foreground">Total: {money(itemTotal(i))}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Desconto (R$)</Label>
            <Input type="number" step="0.01" value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value || "0"))} />
          </div>
          <div>
            <Label>Acréscimo (R$)</Label>
            <Input type="number" step="0.01" value={surcharge}
              onChange={(e) => setSurcharge(parseFloat(e.target.value || "0"))} />
          </div>
        </div>

        <div className="rounded-md bg-muted p-3 text-sm space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span><span>{money(total)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Formas de pagamento</Label>
            <Button size="sm" variant="outline" onClick={addPayment}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          {payments.map((p, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
              <div>
                <Select value={p.payment_option_id ?? "cash"}
                  onValueChange={(v) => {
                    const opt = options.find((o) => o.id === v);
                    const next = [...payments];
                    next[idx] = { ...p, payment_option_id: opt?.id ?? null, method_name: opt?.name ?? "Dinheiro" };
                    setPayments(next);
                  }}>
                  <SelectTrigger><SelectValue placeholder="Forma" /></SelectTrigger>
                  <SelectContent>
                    {options.length ? options.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)
                      : <SelectItem value="cash">Dinheiro</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <Input className="w-28" type="number" step="0.01" value={(p.amount_cents / 100).toFixed(2)}
                onChange={(e) => {
                  const next = [...payments];
                  next[idx] = { ...p, amount_cents: toCents(e.target.value) };
                  setPayments(next);
                }} />
              <Button size="icon" variant="ghost" onClick={() => setPayments(payments.filter((_, k) => k !== idx))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {payments.length > 0 && remaining !== 0 && (
            <p className={`text-xs ${remaining > 0 ? "text-amber-600" : "text-rose-600"}`}>
              {remaining > 0 ? `Falta ${money(remaining)}` : `Excedente de ${money(-remaining)}`}
            </p>
          )}
        </div>

        <div>
          <Label>Observações</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={loading || !items.length}
          onClick={() => onSave({
            items, payments, customer_id: customer || null,
            discount_cents: toCents(discount), surcharge_cents: toCents(surcharge), notes,
          })}
        >
          Finalizar venda
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
