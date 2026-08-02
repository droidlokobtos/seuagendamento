/**
 * Motor de custos da plataforma — Calculadora de Procedimentos.
 *
 * Toda a composição de custo, conversão de unidades, formação de preço e
 * indicadores de lucratividade passam por aqui. O mesmo módulo é usado no
 * frontend (feedback imediato) e no servidor (validação de integridade).
 */

export type ProcedureRow = {
  id: string;
  company_id: string;
  name: string;
  service_id: string | null;
  category: string | null;
  subcategory: string | null;
  duration_min: number;
  duration_min_min: number | null;
  duration_max_min: number | null;
  suggested_price_cents: number;
  min_price_cents: number;
  ideal_price_cents: number;
  practiced_price_cents: number | null;
  promo_price_cents: number | null;
  image_url: string | null;
  description: string | null;
  active: boolean;
  labor_hour_rate_cents: number;
  commission_type: string;
  commission_value: number;
  other_costs_cents: number;
  target_margin_pct: number;
  block_below_cost: boolean;
  apply_overhead: boolean;
  created_at: string;
  updated_at: string;
};

export type ProcedureItem = {
  id?: string;
  procedure_id?: string;
  company_id?: string;
  product_id: string | null;
  product_name: string | null;
  category?: string | null;
  quantity: number;
  /** unidade do estoque (compra) */
  unit: string;
  purchase_unit?: string | null;
  /** unidade em que o insumo é consumido no procedimento */
  consumption_unit?: string | null;
  conversion_factor?: number;
  converted_qty?: number;
  unit_cost: number;
  notes: string | null;
};

export type ProcedureCost = {
  id?: string;
  procedure_id?: string;
  company_id?: string;
  label: string;
  amount_cents: number;
};

export type OverheadCost = {
  id?: string;
  company_id?: string;
  label: string;
  monthly_cents: number;
  include_in_costing: boolean;
};

export type CostingSettings = {
  company_id?: string;
  allocation_basis: "hour" | "appointment";
  monthly_hours: number;
  monthly_appointments: number;
  default_margin_pct: number;
  min_margin_pct: number;
  block_below_cost: boolean;
};

export const DEFAULT_COSTING: CostingSettings = {
  allocation_basis: "hour",
  monthly_hours: 160,
  monthly_appointments: 100,
  default_margin_pct: 40,
  min_margin_pct: 10,
  block_below_cost: true,
};

export type UnitConversion = {
  id?: string;
  company_id?: string;
  /** 1 from_unit = factor to_unit */
  from_unit: string;
  to_unit: string;
  factor: number;
  notes?: string | null;
};

export const UNITS = [
  "un", "ml", "l", "g", "kg", "cápsula", "gota", "cm", "m", "par", "kit",
  "aplicação", "caixa", "pacote", "frasco", "ampola", "sachê", "tubo", "seringa", "agulha",
];

/** Conversões conhecidas pelo sistema (1 from = factor to). */
export const BASE_CONVERSIONS: UnitConversion[] = [
  { from_unit: "l", to_unit: "ml", factor: 1000 },
  { from_unit: "litro", to_unit: "ml", factor: 1000 },
  { from_unit: "kg", to_unit: "g", factor: 1000 },
  { from_unit: "m", to_unit: "cm", factor: 100 },
  { from_unit: "caixa", to_unit: "un", factor: 1 },
  { from_unit: "pacote", to_unit: "un", factor: 1 },
  { from_unit: "kit", to_unit: "un", factor: 1 },
  { from_unit: "par", to_unit: "un", factor: 2 },
];

/** Conversões sugeridas ao administrador (precisam do valor real da embalagem). */
export const SUGGESTED_CUSTOM = [
  { from_unit: "frasco", to_unit: "ml" },
  { from_unit: "ampola", to_unit: "ml" },
  { from_unit: "sachê", to_unit: "g" },
  { from_unit: "tubo", to_unit: "ml" },
  { from_unit: "caixa", to_unit: "un" },
  { from_unit: "pacote", to_unit: "un" },
];

export const COST_PRESETS = [
  "Energia elétrica", "Água", "Internet", "Aluguel", "Contabilidade", "Limpeza",
  "Lavanderia", "Materiais descartáveis", "Esterilização", "Depreciação de equipamentos",
  "Manutenção", "Taxas administrativas", "Impostos", "Outros",
];

const norm = (u: string | null | undefined) =>
  (u ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const round = (n: number, d = 6) => {
  const f = 10 ** d;
  return Math.round((Number(n) || 0) * f) / f;
};

/**
 * Quantas unidades de compra correspondem a 1 unidade de consumo.
 * Retorna null quando não existe conversão conhecida entre as unidades.
 */
export function conversionFactor(
  consumptionUnit: string | null | undefined,
  purchaseUnit: string | null | undefined,
  custom: UnitConversion[] = [],
): number | null {
  const from = norm(consumptionUnit);
  const to = norm(purchaseUnit);
  if (!from || !to) return null;
  if (from === to) return 1;

  const all = [...custom, ...BASE_CONVERSIONS];
  // 1 purchase = f consumption  ->  1 consumption = 1/f purchase
  const direct = all.find((c) => norm(c.from_unit) === to && norm(c.to_unit) === from);
  if (direct && Number(direct.factor) > 0) return round(1 / Number(direct.factor));
  // 1 consumption = f purchase
  const inverse = all.find((c) => norm(c.from_unit) === from && norm(c.to_unit) === to);
  if (inverse && Number(inverse.factor) > 0) return round(Number(inverse.factor));
  return null;
}

/** Custo de um insumo (em reais), já convertido para a unidade do estoque. */
export function itemCost(item: ProcedureItem, custom: UnitConversion[] = []): number {
  const f =
    item.conversion_factor && Number(item.conversion_factor) > 0
      ? Number(item.conversion_factor)
      : conversionFactor(item.consumption_unit ?? item.unit, item.purchase_unit ?? item.unit, custom) ?? 1;
  return round((Number(item.quantity) || 0) * f * (Number(item.unit_cost) || 0), 4);
}

/** Quantidade que será baixada do estoque (na unidade de compra). */
export function itemConvertedQty(item: ProcedureItem, custom: UnitConversion[] = []): number {
  const f =
    item.conversion_factor && Number(item.conversion_factor) > 0
      ? Number(item.conversion_factor)
      : conversionFactor(item.consumption_unit ?? item.unit, item.purchase_unit ?? item.unit, custom) ?? 1;
  return round((Number(item.quantity) || 0) * f, 6);
}

export type ProcedureMath = {
  price: number;
  productsCost: number;
  laborCost: number;
  commissionCost: number;
  operationalCost: number;
  overheadCost: number;
  /** custo sem a comissão percentual (base para formação de preço) */
  fixedCost: number;
  totalCost: number;
  grossProfit: number;
  netProfit: number;
  marginPct: number;
  costPct: number;
  suggestion: { min: number; ideal: number; premium: number };
};

export type ProcedureBase = {
  duration_min: number;
  labor_hour_rate_cents: number;
  commission_type: string;
  commission_value: number;
  other_costs_cents: number;
  practiced_price_cents: number | null;
  suggested_price_cents: number;
  promo_price_cents?: number | null;
  target_margin_pct?: number | null;
  apply_overhead?: boolean | null;
};

/** Rateio mensal de custos operacionais da empresa por procedimento. */
export function overheadForProcedure(
  durationMin: number,
  overheads: OverheadCost[],
  settings: CostingSettings = DEFAULT_COSTING,
): number {
  const monthly = overheads
    .filter((o) => o.include_in_costing)
    .reduce((s, o) => s + (Number(o.monthly_cents) || 0), 0) / 100;
  if (monthly <= 0) return 0;
  if (settings.allocation_basis === "appointment") {
    const n = Number(settings.monthly_appointments) || 0;
    return n > 0 ? round(monthly / n, 4) : 0;
  }
  const hours = Number(settings.monthly_hours) || 0;
  if (hours <= 0) return 0;
  return round((monthly / hours) * ((Number(durationMin) || 0) / 60), 4);
}

/** Cálculo financeiro completo de um procedimento (valores em reais). */
export function computeProcedure(
  base: ProcedureBase,
  items: ProcedureItem[],
  costs: ProcedureCost[],
  opts: {
    conversions?: UnitConversion[];
    overheads?: OverheadCost[];
    settings?: CostingSettings;
  } = {},
): ProcedureMath {
  const settings = opts.settings ?? DEFAULT_COSTING;
  const conversions = opts.conversions ?? [];

  const price =
    (base.promo_price_cents && base.promo_price_cents > 0
      ? base.promo_price_cents
      : base.practiced_price_cents && base.practiced_price_cents > 0
        ? base.practiced_price_cents
        : base.suggested_price_cents || 0) / 100;

  const productsCost = round(items.reduce((s, i) => s + itemCost(i, conversions), 0), 4);

  const laborCost = round(
    ((Number(base.duration_min) || 0) / 60) * ((Number(base.labor_hour_rate_cents) || 0) / 100),
    4,
  );

  const commissionPct = base.commission_type === "fixed" ? 0 : Number(base.commission_value) || 0;
  const commissionCost =
    base.commission_type === "fixed"
      ? Number(base.commission_value) || 0
      : round((price * commissionPct) / 100, 4);

  const operationalCost = round(
    costs.reduce((s, c) => s + (Number(c.amount_cents) || 0), 0) / 100 +
      (Number(base.other_costs_cents) || 0) / 100,
    4,
  );

  const overheadCost =
    base.apply_overhead === false
      ? 0
      : overheadForProcedure(base.duration_min, opts.overheads ?? [], settings);

  const fixedCost = round(
    productsCost + laborCost + operationalCost + overheadCost +
      (base.commission_type === "fixed" ? commissionCost : 0),
    4,
  );
  const totalCost = round(fixedCost + (base.commission_type === "fixed" ? 0 : commissionCost), 4);
  const grossProfit = round(price - productsCost - laborCost, 4);
  const netProfit = round(price - totalCost, 4);

  const priceFor = (marginPct: number) => {
    const denom = 1 - marginPct / 100 - commissionPct / 100;
    if (denom <= 0.05) return round(fixedCost * 2, 2);
    return round(fixedCost / denom, 2);
  };

  const target = Number(base.target_margin_pct ?? settings.default_margin_pct) || 0;

  return {
    price,
    productsCost,
    laborCost,
    commissionCost,
    operationalCost,
    overheadCost,
    fixedCost,
    totalCost,
    grossProfit,
    netProfit,
    marginPct: price > 0 ? round((netProfit / price) * 100, 2) : 0,
    costPct: price > 0 ? round((totalCost / price) * 100, 2) : 0,
    suggestion: {
      min: priceFor(Number(settings.min_margin_pct) || 0),
      ideal: priceFor(target),
      premium: priceFor(Math.min(target + 15, 85)),
    },
  };
}

export type ProductLite = {
  id: string;
  name: string;
  unit: string | null;
  cost_price: number | null;
  avg_cost: number | null;
  last_cost: number | null;
  stock_qty: number | null;
  min_stock: number | null;
  batch?: string | null;
  expires_on?: string | null;
  active?: boolean | null;
  scope?: string | null;
  category?: string | null;
};

export type ProcedureAlert = { level: "warn" | "danger"; message: string };

/** Alertas inteligentes de um procedimento. */
export function procedureAlerts(
  math: ProcedureMath,
  items: ProcedureItem[],
  products: ProductLite[],
  conversions: UnitConversion[] = [],
  minMarginPct = 10,
): ProcedureAlert[] {
  const out: ProcedureAlert[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

  for (const it of items) {
    const p = products.find((x) => x.id === it.product_id);
    const label = it.product_name || p?.name || "Insumo";
    if (!it.product_id) {
      out.push({ level: "danger", message: `${label}: produto não vinculado ao Estoque de Atendimento.` });
      continue;
    }
    if (!(Number(it.unit_cost) > 0)) out.push({ level: "warn", message: `${label}: produto sem custo cadastrado.` });
    if (!p?.unit) out.push({ level: "warn", message: `${label}: produto sem unidade cadastrada.` });
    const f = conversionFactor(it.consumption_unit ?? it.unit, it.purchase_unit ?? p?.unit ?? it.unit, conversions);
    if (f == null) {
      out.push({
        level: "danger",
        message: `${label}: conversão inválida entre ${it.consumption_unit ?? it.unit} e ${it.purchase_unit ?? p?.unit}.`,
      });
    }
    if (p && Number(p.stock_qty ?? 0) <= 0) out.push({ level: "warn", message: `${label}: sem estoque.` });
    if (p?.expires_on) {
      if (p.expires_on < today) out.push({ level: "danger", message: `${label}: produto vencido (${p.expires_on}).` });
      else if (p.expires_on <= in30) out.push({ level: "warn", message: `${label}: vence em breve (${p.expires_on}).` });
    }
  }

  if (math.price > 0 && math.netProfit < 0) {
    out.push({ level: "danger", message: "Procedimento operando no prejuízo." });
  } else if (math.price > 0 && math.marginPct < minMarginPct) {
    out.push({ level: "warn", message: `Margem abaixo do mínimo (${math.marginPct.toFixed(1)}%).` });
  }
  return out;
}
