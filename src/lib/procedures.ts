export type ProcedureRow = {
  id: string;
  company_id: string;
  name: string;
  service_id: string | null;
  category: string | null;
  duration_min: number;
  suggested_price_cents: number;
  min_price_cents: number;
  ideal_price_cents: number;
  practiced_price_cents: number | null;
  description: string | null;
  active: boolean;
  labor_hour_rate_cents: number;
  commission_type: string;
  commission_value: number;
  other_costs_cents: number;
  created_at: string;
  updated_at: string;
};

export type ProcedureItem = {
  id?: string;
  procedure_id?: string;
  company_id?: string;
  product_id: string | null;
  product_name: string | null;
  quantity: number;
  unit: string;
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

export const UNITS = [
  "un",
  "ml",
  "l",
  "g",
  "kg",
  "cápsula",
  "gota",
  "cm",
  "m",
  "par",
  "kit",
  "aplicação",
];

export const COST_PRESETS = [
  "Energia elétrica",
  "Água",
  "Descartáveis",
  "Equipamentos",
  "Esterilização",
  "Materiais de apoio",
];

export type ProcedureMath = {
  price: number;
  productsCost: number;
  laborCost: number;
  commissionCost: number;
  operationalCost: number;
  totalCost: number;
  grossProfit: number;
  marginPct: number;
  costPct: number;
};

/** Cálculo financeiro completo de um procedimento (valores em reais). */
export function computeProcedure(
  base: {
    duration_min: number;
    labor_hour_rate_cents: number;
    commission_type: string;
    commission_value: number;
    other_costs_cents: number;
    practiced_price_cents: number | null;
    suggested_price_cents: number;
  },
  items: ProcedureItem[],
  costs: ProcedureCost[],
): ProcedureMath {
  const price =
    (base.practiced_price_cents && base.practiced_price_cents > 0
      ? base.practiced_price_cents
      : base.suggested_price_cents || 0) / 100;

  const productsCost = items.reduce(
    (s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_cost) || 0),
    0,
  );

  const laborCost =
    ((Number(base.duration_min) || 0) / 60) * ((Number(base.labor_hour_rate_cents) || 0) / 100);

  const commissionCost =
    base.commission_type === "fixed"
      ? Number(base.commission_value) || 0
      : (price * (Number(base.commission_value) || 0)) / 100;

  const operationalCost =
    costs.reduce((s, c) => s + (Number(c.amount_cents) || 0), 0) / 100 +
    (Number(base.other_costs_cents) || 0) / 100;

  const totalCost = productsCost + laborCost + commissionCost + operationalCost;
  const grossProfit = price - totalCost;

  return {
    price,
    productsCost,
    laborCost,
    commissionCost,
    operationalCost,
    totalCost,
    grossProfit,
    marginPct: price > 0 ? (grossProfit / price) * 100 : 0,
    costPct: price > 0 ? (totalCost / price) * 100 : 0,
  };
}
