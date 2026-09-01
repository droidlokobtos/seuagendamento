import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeProcedure, itemConvertedQty, conversionFactor,
  DEFAULT_COSTING,
  type CostingSettings, type OverheadCost, type ProcedureCost,
  type ProcedureItem, type UnitConversion,
} from "@/lib/procedures";

export type SaveProcedureInput = {
  companyId: string;
  id?: string | null;
  base: Record<string, any>;
  items: ProcedureItem[];
  costs: ProcedureCost[];
  note?: string | null;
};

/**
 * Grava um procedimento revalidando todos os cálculos no servidor e
 * registrando uma nova versão no histórico (nunca apagada).
 */
export const saveProcedure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: SaveProcedureInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, base, items, costs } = data;

    const { data: isAdmin } = await supabase.rpc("is_company_admin", { _company: companyId });
    if (!isAdmin) throw new Error("Somente administradores podem alterar procedimentos.");

    if (!String(base['name'] ?? "").trim()) throw new Error("Informe o nome do procedimento.");
    if (!(Number(base['duration_min']) > 0)) throw new Error("Informe o tempo médio do procedimento.");

    const [{ data: conv }, { data: over }, { data: cfg }] = await Promise.all([
      supabase.from("unit_conversions").select("from_unit, to_unit, factor").eq("company_id", companyId),
      supabase.from("overhead_costs").select("label, monthly_cents, include_in_costing").eq("company_id", companyId),
      supabase.from("costing_settings").select("*").eq("company_id", companyId).maybeSingle(),
    ]);

    const conversions = (conv ?? []) as UnitConversion[];
    const overheads = (over ?? []) as OverheadCost[];
    const settings: CostingSettings = cfg
      ? {
          allocation_basis: (cfg as any).allocation_basis === "appointment" ? "appointment" : "hour",
          monthly_hours: Number((cfg as any).monthly_hours),
          monthly_appointments: Number((cfg as any).monthly_appointments),
          default_margin_pct: Number((cfg as any).default_margin_pct),
          min_margin_pct: Number((cfg as any).min_margin_pct),
          block_below_cost: !!(cfg as any).block_below_cost,
        }
      : DEFAULT_COSTING;

    // Todos os insumos precisam existir no Estoque de Atendimento
    const ids = items.map((i) => i.product_id).filter(Boolean) as string[];
    if (ids.length) {
      const { data: prods } = await supabase
        .from("products").select("id").eq("company_id", companyId).in("id", ids);
      const found = new Set((prods ?? []).map((p: any) => p.id));
      if (ids.some((id) => !found.has(id))) {
        throw new Error("Há insumos que não existem no estoque desta empresa.");
      }
    }
    if (items.some((i) => !i.product_id)) {
      throw new Error("Todo insumo deve ser escolhido no Estoque de Atendimento.");
    }
    if (items.some((i) => !(Number(i.quantity) > 0))) {
      throw new Error("Quantidade dos insumos deve ser maior que zero.");
    }
    for (const i of items) {
      const f = conversionFactor(i.consumption_unit ?? i.unit, i.purchase_unit ?? i.unit, conversions);
      if (f == null) {
        throw new Error(
          `Conversão inválida entre "${i.consumption_unit ?? i.unit}" e "${i.purchase_unit ?? i.unit}". Cadastre a conversão.`,
        );
      }
    }

    const math = computeProcedure(base as any, items, costs, { conversions, overheads, settings });

    const blockBelow = base['block_below_cost'] ?? settings.block_below_cost;
    if (blockBelow && math.price > 0 && math.price < math.totalCost) {
      throw new Error(
        `Preço (R$ ${math.price.toFixed(2)}) abaixo do custo total (R$ ${math.totalCost.toFixed(2)}).`,
      );
    }

    let procId = data.id ?? undefined;
    if (procId) {
      const { error } = await supabase.from("procedures").update(base as any).eq("id", procId);
      if (error) throw new Error(error.message);
      await supabase.from("procedure_items").delete().eq("procedure_id", procId);
      await supabase.from("procedure_costs").delete().eq("procedure_id", procId);
    } else {
      const { data: created, error } = await supabase
        .from("procedures")
        .insert({ ...(base as any), company_id: companyId, created_by: userId })
        .select("id").single();
      if (error) throw new Error(error.message);
      procId = created.id;
    }

    if (items.length) {
      const rows = items.map((i) => ({
        procedure_id: procId, company_id: companyId,
        product_id: i.product_id, product_name: i.product_name ?? null,
        category: i.category ?? null,
        quantity: Number(i.quantity) || 0,
        unit: i.purchase_unit ?? i.unit,
        purchase_unit: i.purchase_unit ?? i.unit,
        consumption_unit: i.consumption_unit ?? i.unit,
        conversion_factor:
          conversionFactor(i.consumption_unit ?? i.unit, i.purchase_unit ?? i.unit, conversions) ?? 1,
        converted_qty: itemConvertedQty(i, conversions),
        unit_cost: Number(i.unit_cost) || 0,
        notes: i.notes ?? null,
      }));
      const { error } = await supabase.from("procedure_items").insert(rows as any);
      if (error) throw new Error(error.message);
    }

    const validCosts = costs.filter((c) => c.label?.trim());
    if (validCosts.length) {
      const { error } = await supabase.from("procedure_costs").insert(
        validCosts.map((c) => ({
          procedure_id: procId, company_id: companyId,
          label: c.label.trim(), amount_cents: Number(c.amount_cents) || 0,
        })) as any,
      );
      if (error) throw new Error(error.message);
    }

    const { count } = await supabase
      .from("procedure_versions")
      .select("id", { count: "exact", head: true })
      .eq("procedure_id", procId);

    await supabase.from("procedure_versions").insert({
      company_id: companyId,
      procedure_id: procId,
      version: (count ?? 0) + 1,
      snapshot: { base, items, costs: validCosts } as any,
      totals: math as any,
      note: data.note ?? null,
      actor_user_id: userId,
    } as any);

    return { id: procId, math };
  });
