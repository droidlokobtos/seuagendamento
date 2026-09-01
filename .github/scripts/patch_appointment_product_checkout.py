from pathlib import Path
import re

p = Path('src/routes/_authenticated/app/payments.tsx')
text = p.read_text(encoding='utf-8')

text = text.replace('import { useMemo, useState } from "react";', 'import { useEffect, useMemo, useState } from "react";', 1)
text = text.replace('import { Check, X, FileText, History, Plus, Wallet, Clock, RotateCcw } from "lucide-react";', 'import { Check, X, FileText, History, Plus, Wallet, Clock, RotateCcw, ShoppingCart, Trash2 } from "lucide-react";', 1)

marker = '''type Pay = {
  id: string; appointment_id: string; kind: "deposit" | "final" | "extra" | "refund";
  amount_cents: number; status: "pending" | "approved" | "rejected";
  proof_url: string | null; transaction_ref: string | null; method: string | null;
  reject_reason: string | null; created_at: string;
};'''
product_type = marker + '''

type CheckoutProduct = {
  id: string; name: string; stock_qty: number; sale_price: number; promo_price: number | null;
};
type CheckoutProductLine = { product_id: string; name: string; quantity: number; unit_price_cents: number };'''
if marker not in text:
    raise SystemExit('Pay type marker missing')
text = text.replace(marker, product_type, 1)

payments_query_marker = '''  const { data: payments = [] } = useQuery({
    queryKey: ["fin_payments", companyId, from, to],'''
products_query = '''  const { data: checkoutProducts = [] } = useQuery({
    queryKey: ["checkout-products", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("products")
        .select("id,name,stock_qty,sale_price,promo_price")
        .eq("company_id", companyId).eq("scope", "sale").eq("active", true)
        .gt("stock_qty", 0).order("name");
      if (error) throw error;
      return (data ?? []) as unknown as CheckoutProduct[];
    },
  });

'''
if payments_query_marker not in text:
    raise SystemExit('payments query marker missing')
text = text.replace(payments_query_marker, products_query + payments_query_marker, 1)

old_mutation = '''  const addPayment = useMutation({
    mutationFn: async (v: { appointment_id: string; kind: Pay["kind"]; amount_cents: number; method: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("appointment_payments").insert({
        company_id: companyId,
        appointment_id: v.appointment_id,
        kind: v.kind,
        amount_cents: v.amount_cents,
        method: v.method,
        status: "approved",
        created_by: u.user?.id ?? null,
        reviewed_by: u.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
    },'''
new_mutation = '''  const addPayment = useMutation({
    mutationFn: async (v: { appointment_id: string; kind: Pay["kind"]; amount_cents: number; method: string; products?: CheckoutProductLine[] }) => {
      if (v.products?.length) {
        const { error } = await (supabase as any).rpc("checkout_appointment_with_products", {
          _appointment_id: v.appointment_id,
          _products: v.products.map((p) => ({ product_id: p.product_id, quantity: p.quantity })),
          _payment_kind: v.kind,
          _payment_amount_cents: v.amount_cents,
          _payment_method: v.method,
        });
        if (error) throw error;
        return;
      }

      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("appointment_payments").insert({
        company_id: companyId,
        appointment_id: v.appointment_id,
        kind: v.kind,
        amount_cents: v.amount_cents,
        method: v.method,
        status: "approved",
        created_by: u.user?.id ?? null,
        reviewed_by: u.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
    },'''
if old_mutation not in text:
    raise SystemExit('payment mutation marker missing')
text = text.replace(old_mutation, new_mutation, 1)

old_success = '''      qc.invalidateQueries({ queryKey: ["finances", companyId] });
      qc.invalidateQueries({ queryKey: ["appts", companyId] });'''
new_success = '''      qc.invalidateQueries({ queryKey: ["finances", companyId] });
      qc.invalidateQueries({ queryKey: ["appts", companyId] });
      qc.invalidateQueries({ queryKey: ["sales", companyId] });
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      qc.invalidateQueries({ queryKey: ["checkout-products", companyId] });'''
text = text.replace(old_success, new_success, 1)

old_dialog_call = '''        <PaymentDialog
          appt={payFor}
          onClose={() => setPayFor(null)}
          loading={addPayment.isPending}
          onSave={(v) => addPayment.mutate({ appointment_id: payFor.id, ...v })}
        />'''
new_dialog_call = '''        <PaymentDialog
          appt={payFor}
          products={checkoutProducts}
          onClose={() => setPayFor(null)}
          loading={addPayment.isPending}
          onSave={(v) => addPayment.mutate({ appointment_id: payFor.id, ...v })}
        />'''
if old_dialog_call not in text:
    raise SystemExit('dialog call marker missing')
text = text.replace(old_dialog_call, new_dialog_call, 1)

replacement = r'''function PaymentDialog({ appt, products, onClose, onSave, loading }: {
  appt: Appt;
  products: CheckoutProduct[];
  onClose: () => void;
  onSave: (v: { kind: "deposit" | "final" | "extra" | "refund"; amount_cents: number; method: string; products: CheckoutProductLine[] }) => void;
  loading: boolean;
}) {
  const f = computeFinance({
    subtotalCents: appt.total_cents, discountCents: appt.discount_cents,
    surchargeCents: appt.surcharge_cents, paidCents: appt.paid_cents,
    depositRequiredCents: appt.deposit_required_cents,
  });
  const defaultKind = appt.default_payment_kind ?? "final";
  const initialCents = defaultKind === "deposit" && f.depositDueCents > 0 ? f.depositDueCents : f.balanceCents;
  const [kind, setKind] = useState<"deposit" | "final" | "extra" | "refund">(defaultKind);
  const [amount, setAmount] = useState((initialCents / 100).toFixed(2));
  const [method, setMethod] = useState("pix");
  const [productSearch, setProductSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [lines, setLines] = useState<CheckoutProductLine[]>([]);

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLocaleLowerCase("pt-BR");
    return products.filter((p) => !term || p.name.toLocaleLowerCase("pt-BR").includes(term)).slice(0, 50);
  }, [products, productSearch]);

  const productsTotal = useMemo(() => lines.reduce((sum, l) => sum + Math.round(l.quantity * l.unit_price_cents), 0), [lines]);
  const combinedBalance = f.balanceCents + productsTotal;
  const combinedTotal = f.totalCents + productsTotal;

  useEffect(() => {
    if (kind === "final") setAmount((combinedBalance / 100).toFixed(2));
  }, [productsTotal, kind, combinedBalance]);

  const addProduct = () => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const price = Math.round(Number(p.promo_price && Number(p.promo_price) > 0 ? p.promo_price : p.sale_price) * 100);
    setLines((prev) => {
      const existing = prev.find((x) => x.product_id === p.id);
      if (existing) {
        if (existing.quantity + 1 > Number(p.stock_qty)) { toast.error("Quantidade maior que o estoque disponível"); return prev; }
        return prev.map((x) => x.product_id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
      }
      return [...prev, { product_id: p.id, name: p.name, quantity: 1, unit_price_cents: price }];
    });
    setProductId("");
    setProductSearch("");
  };

  const setQty = (id: string, quantity: number) => {
    const p = products.find((x) => x.id === id);
    const max = Math.max(1, Math.floor(Number(p?.stock_qty ?? 1)));
    const qty = Math.min(max, Math.max(1, Math.floor(quantity || 1)));
    setLines((prev) => prev.map((x) => x.product_id === id ? { ...x, quantity: qty } : x));
  };

  const changeKind = (v: "deposit" | "final" | "extra" | "refund") => {
    setKind(v);
    if (v === "deposit") {
      const suggested = f.depositDueCents > 0 ? f.depositDueCents : Math.min(f.depositRequiredCents || combinedBalance, combinedBalance);
      if (suggested > 0) setAmount((suggested / 100).toFixed(2));
    } else if (v === "final") setAmount((combinedBalance / 100).toFixed(2));
  };

  const parsedCents = Math.round((parseFloat(amount) || 0) * 100);
  const exceedsBalance = kind !== "refund" && kind !== "extra" && parsedCents > combinedBalance;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{kind === "deposit" ? "Registrar sinal antecipado" : "Fechar atendimento e pagamento"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Serviços / atendimento</span><span>{brl(f.totalCents / 100)}</span></div>
            {productsTotal > 0 && <div className="flex justify-between"><span>Produtos adicionados</span><span>{brl(productsTotal / 100)}</span></div>}
            <div className="flex justify-between font-semibold border-t pt-1"><span>Total da compra</span><span>{brl(combinedTotal / 100)}</span></div>
            <div className="flex justify-between"><span>Já pago</span><span>{brl(f.paidCents / 100)}</span></div>
            <div className="flex justify-between font-semibold"><span>Saldo a receber</span><span>{brl(combinedBalance / 100)}</span></div>
          </div>

          {kind !== "deposit" && kind !== "refund" && (
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" /><div><p className="text-sm font-medium">Adicionar produtos ao atendimento</p><p className="text-xs text-muted-foreground">O produto será vinculado a este cliente, baixará do estoque e entrará no mesmo pagamento.</p></div></div>
              <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Digite o nome do produto…" autoComplete="off" />
              <div className="flex gap-2">
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                  <SelectContent>{filteredProducts.length ? filteredProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {brl(Number(p.promo_price && Number(p.promo_price) > 0 ? p.promo_price : p.sale_price))} · estoque {Number(p.stock_qty)}</SelectItem>) : <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum produto encontrado.</div>}</SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addProduct} disabled={!productId}>Adicionar</Button>
              </div>
              {lines.length > 0 && <div className="divide-y rounded-md border">{lines.map((l) => <div key={l.product_id} className="flex items-center gap-2 p-2 text-sm"><div className="min-w-0 flex-1"><p className="font-medium truncate">{l.name}</p><p className="text-xs text-muted-foreground">{brl(l.unit_price_cents / 100)} cada</p></div><Input className="w-20" type="number" min="1" value={l.quantity} onChange={(e) => setQty(l.product_id, Number(e.target.value))} /><span className="w-24 text-right font-medium">{brl((l.quantity * l.unit_price_cents) / 100)}</span><Button type="button" size="icon" variant="ghost" onClick={() => setLines((prev) => prev.filter((x) => x.product_id !== l.product_id))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>}
            </div>
          )}

          {kind === "deposit" && f.depositDueCents > 0 && <p className="rounded-md bg-muted px-3 py-2 text-xs">Valor sugerido do sinal ainda pendente: <strong>{brl(f.depositDueCents / 100)}</strong>. A administradora pode alterar o valor abaixo.</p>}
          <div><Label>Tipo</Label><Select value={kind} onValueChange={(v) => changeKind(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="deposit">Sinal (antecipado)</SelectItem><SelectItem value="final">Pagamento final</SelectItem><SelectItem value="extra">Acréscimo</SelectItem><SelectItem value="refund">Estorno</SelectItem></SelectContent></Select></div>
          <div><Label>Valor recebido (R$)</Label><Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />{exceedsBalance && <p className="mt-1 text-xs text-destructive">O valor não pode ser maior que o saldo total do atendimento com os produtos.</p>}</div>
          <div><Label>Forma de pagamento</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pix">PIX</SelectItem><SelectItem value="cash">Dinheiro</SelectItem><SelectItem value="credit_card">Cartão de crédito</SelectItem><SelectItem value="debit_card">Cartão de débito</SelectItem><SelectItem value="bank_transfer">Transferência</SelectItem><SelectItem value="other">Outro</SelectItem></SelectContent></Select></div>
          <p className="text-xs text-muted-foreground">Ao salvar, serviço e produtos permanecem vinculados ao mesmo cliente e ao mesmo atendimento. A baixa de estoque dos produtos é automática.</p>
        </div>
        <DialogFooter><Button disabled={loading || parsedCents <= 0 || exceedsBalance} onClick={() => onSave({ kind, amount_cents: parsedCents, method, products: lines })}>{loading ? "Registrando..." : kind === "deposit" ? "Registrar sinal" : "Concluir pagamento"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuditDialog'''

text, n = re.subn(r'function PaymentDialog\([\s\S]*?\nfunction AuditDialog', replacement, text, count=1)
if n != 1:
    raise SystemExit('PaymentDialog block not replaced')

p.write_text(text, encoding='utf-8')
