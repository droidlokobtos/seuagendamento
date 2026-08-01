/**
 * Regras compartilhadas dos módulos de Estoque, Vendas e Financeiro.
 * Todos os valores monetários de venda trafegam em CENTAVOS.
 */

export type ProductScope = "service" | "sale";

export type Product = {
  id: string;
  company_id: string;
  scope: ProductScope;
  name: string;
  internal_code: string | null;
  barcode: string | null;
  sku: string | null;
  category: string | null;
  brand: string | null;
  supplier: string | null;
  unit: string;
  stock_qty: number;
  min_stock: number;
  ideal_stock: number;
  cost_price: number;
  avg_cost: number;
  last_cost: number | null;
  sale_price: number;
  promo_price: number | null;
  location: string | null;
  batch: string | null;
  expires_on: string | null;
  image_url: string | null;
  notes: string | null;
  active: boolean;
};

export type SaleItem = {
  id?: string;
  product_id: string | null;
  service_id?: string | null;
  kind: "product" | "service";
  name: string;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
  total_cents: number;
  unit_cost?: number | null;
};

export type SalePayment = {
  payment_option_id: string | null;
  method_name: string;
  amount_cents: number;
  installments: number;
};

export const SCOPE_LABEL: Record<ProductScope, string> = {
  service: "Estoque de Atendimento",
  sale: "Estoque de Vendas",
};

export const MOVEMENT_OPERATIONS = [
  { value: "compra", label: "Compra" },
  { value: "ajuste", label: "Ajuste" },
  { value: "transferencia", label: "Transferência" },
  { value: "inventario", label: "Inventário" },
] as const;

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Internet", "Alimentação", "Aluguel", "Brindes", "Combustível", "Contabilidade",
  "Marketing", "Energia elétrica", "Água", "Impostos", "Outros",
];

export const money = (cents: number) =>
  (Math.round(cents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const toCents = (reais: number | string | null | undefined) =>
  Math.round(Number(reais ?? 0) * 100) || 0;

export const itemTotal = (i: Pick<SaleItem, "quantity" | "unit_price_cents" | "discount_cents">) =>
  Math.max(0, Math.round(i.quantity * i.unit_price_cents) - (i.discount_cents || 0));

export function saleTotals(items: SaleItem[], discountCents = 0, surchargeCents = 0) {
  const subtotal = items.reduce((s, i) => s + itemTotal(i), 0);
  const total = Math.max(0, subtotal - discountCents + surchargeCents);
  return { subtotal, total };
}

/** Preço de venda efetivo de um produto (promocional quando definido). */
export const effectivePriceCents = (p: Pick<Product, "sale_price" | "promo_price">) =>
  toCents(p.promo_price && Number(p.promo_price) > 0 ? p.promo_price : p.sale_price);

export type StockAlert = { product: Product; kind: "out" | "low" | "expired" | "expiring" };

export function stockAlerts(products: Product[]): StockAlert[] {
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const out: StockAlert[] = [];
  for (const p of products) {
    if (!p.active) continue;
    if (Number(p.stock_qty) <= 0) out.push({ product: p, kind: "out" });
    else if (Number(p.stock_qty) <= Number(p.min_stock)) out.push({ product: p, kind: "low" });
    if (p.expires_on) {
      if (p.expires_on < today) out.push({ product: p, kind: "expired" });
      else if (p.expires_on <= in30) out.push({ product: p, kind: "expiring" });
    }
  }
  return out;
}

export const ALERT_LABEL: Record<StockAlert["kind"], { label: string; className: string }> = {
  out: { label: "Sem estoque", className: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300" },
  low: { label: "Abaixo do mínimo", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  expired: { label: "Vencido", className: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300" },
  expiring: { label: "Vence em breve", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
};

/** Exporta uma matriz para CSV (Excel abre nativamente). */
export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
