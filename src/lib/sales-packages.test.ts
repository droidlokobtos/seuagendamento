import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260908020000_atomic_sales_packages_credits.sql"),
  "utf8",
).toLowerCase();
const salesPage = readFileSync(
  resolve("src/routes/_authenticated/app/sales.tsx"),
  "utf8",
).toLowerCase();
const costingMigration = readFileSync(
  resolve("supabase/migrations/20260908030000_atomic_simple_costing.sql"),
  "utf8",
).toLowerCase();
const proceduresPage = readFileSync(
  resolve("src/routes/_authenticated/app/procedures.tsx"),
  "utf8",
).toLowerCase();
const consistencyMigration = readFileSync(
  resolve("supabase/migrations/20260908040000_consistency_followup.sql"),
  "utf8",
).toLowerCase();
const customerPlans = readFileSync(
  resolve("src/components/app/CustomerPlansTab.tsx"),
  "utf8",
).toLowerCase();
const teamFunctions = readFileSync(resolve("src/lib/team.functions.ts"), "utf8").toLowerCase();

describe("PDV com pacotes e créditos", () => {
  it("registra venda, créditos, estoque e autoria na mesma transação", () => {
    expect(migration).toContain("register_sale_with_credits");
    expect(migration).toContain("for update of cps");
    expect(migration).toContain("sale_credit_usages");
    expect(migration).toContain("created_by_name");
    expect(migration).toContain("sold_by");
  });

  it("exige que o pagamento corresponda ao valor não coberto", () => {
    expect(migration).toContain("if payment_total <> total then");
    expect(migration).toContain("o pagamento deve corresponder ao total da venda");
  });

  it("estorna crédito, estoque e financeiro quando a venda é cancelada", () => {
    expect(migration).toContain("cancel_sale_with_reversal");
    expect(migration).toContain("sessions_used = greatest(0, sessions_used - credit_row.quantity)");
    expect(migration).toContain("'estorno de venda'");
    expect(migration).toContain("reversed_at = now()");
    expect(migration).toContain("este pacote já possui sessões utilizadas");
  });

  it("carrega todos os clientes por páginas e inclui pacotes no catálogo", () => {
    expect(salesPage).toContain("for (let from = 0; ; from += pagesize)");
    expect(salesPage).toContain("sales-plans");
    expect(salesPage).toContain('kind: "package"');
    expect(salesPage).toContain("créditos de pacote");
  });

  it("vincula a venda ao agendamento e impede consumir a mesma sessão duas vezes", () => {
    expect(migration).toContain("_appointment_id uuid default null");
    expect(salesPage).toContain("_appointment_id: v.appointment_id");
    expect(consistencyMigration).toContain("plan_session_usage_active_appt_service_uidx");
    expect(consistencyMigration).toContain("on conflict do nothing");
  });

  it("oculta usos estornados e classifica o financeiro pelo conteúdo da venda", () => {
    expect(customerPlans).toContain('.is("reversed_at", null)');
    expect(consistencyMigration).toContain("venda mista");
    expect(consistencyMigration).toContain("planos e pacotes");
    expect(consistencyMigration).toContain("serviços");
    expect(consistencyMigration).toContain("produtos");
  });
});

describe("Custeio simplificado", () => {
  it("salva regras, custos e conversões de forma atômica", () => {
    expect(costingMigration).toContain("save_costing_configuration");
    expect(costingMigration).toContain("somente administradores podem alterar o custeio");
    expect(proceduresPage).toContain('rpc("save_costing_configuration"');
    expect(proceduresPage).toContain("existe um custo mensal repetido");
  });
});

describe("Acesso da equipe", () => {
  it("sincroniza vínculo, papel e profissional por funções atômicas", () => {
    expect(consistencyMigration).toContain("sync_company_user_access");
    expect(consistencyMigration).toContain("remove_company_user_access");
    expect(teamFunctions).toContain('rpc("sync_company_user_access"');
    expect(teamFunctions).toContain('rpc("remove_company_user_access"');
  });
});
