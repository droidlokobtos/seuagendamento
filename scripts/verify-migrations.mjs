import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve("supabase/migrations");
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const prefixes = new Map();
const errors = [];
const legacyDuplicatePrefixes = new Set(["20260901150000"]);

for (const file of files) {
  const prefix = file.match(/^(\d{14})_/)?.[1];
  if (!prefix) errors.push(`${file}: nome sem timestamp de 14 dígitos`);
  else if (prefixes.has(prefix) && !legacyDuplicatePrefixes.has(prefix))
    errors.push(`${file}: timestamp duplicado com ${prefixes.get(prefix)}`);
  else prefixes.set(prefix, file);

  const sql = readFileSync(resolve(dir, file), "utf8");
  if (
    prefix &&
    prefix >= "20260901210000" &&
    /SECURITY DEFINER/i.test(sql) &&
    !/SET search_path\s*=|SET search_path\s+TO/i.test(sql)
  ) {
    errors.push(`${file}: SECURITY DEFINER sem search_path explícito`);
  }
}

const required = [
  "20260901210000_scope_company_assets_storage.sql",
  "20260901220000_prevent_concurrent_appointment_overlap.sql",
  "20260901223000_harden_identity_helper_functions.sql",
  "20260901224500_enforce_financial_rpc_permissions.sql",
  "20260901230000_public_api_protection_and_observability.sql",
  "20260904010000_secure_reliable_automations.sql",
  "20260908010000_secure_professional_portal.sql",
  "20260908020000_atomic_sales_packages_credits.sql",
  "20260908030000_atomic_simple_costing.sql",
];
for (const file of required)
  if (!files.includes(file)) errors.push(`${file}: migration obrigatória ausente`);

const latestSql = readFileSync(
  resolve(dir, "20260904010000_secure_reliable_automations.sql"),
  "utf8",
);
if (!/x-automation-secret/i.test(latestSql))
  errors.push("automação: cabeçalho secreto obrigatório ausente");
if (!/try_start_automation_run/i.test(latestSql))
  errors.push("automação: trava contra execução simultânea ausente");

const professionalSql = readFileSync(
  resolve(dir, "20260908010000_secure_professional_portal.sql"),
  "utf8",
);
if (!/cu\.role <> 'staff'/i.test(professionalSql))
  errors.push("painel profissional: escrita de comissão não está bloqueada para profissionais");
if (!/cu\.staff_id = commissions\.staff_id/i.test(professionalSql))
  errors.push("painel profissional: leitura de comissão não está limitada ao titular");
for (const legacyPolicy of [
  "appt member read",
  "appt member write",
  "aps member read",
  "aps member write",
  "tb member read",
  "tb member write",
  "cust member read",
  "cust member write",
]) {
  if (!professionalSql.includes(`DROP POLICY IF EXISTS "${legacyPolicy}"`))
    errors.push(`painel profissional: política permissiva ainda não removida (${legacyPolicy})`);
}
if (!/a\.staff_id = cu\.staff_id/i.test(professionalSql))
  errors.push("painel profissional: clientes não estão limitados à agenda do titular");

const salesSql = readFileSync(
  resolve(dir, "20260908020000_atomic_sales_packages_credits.sql"),
  "utf8",
);
if (!/register_sale_with_credits/i.test(salesSql))
  errors.push("vendas: fechamento atômico com créditos ausente");
if (!/FOR UPDATE OF cps/i.test(salesSql))
  errors.push("vendas: consumo de créditos sem bloqueio concorrente");
if (!/sold_by, expires_at/i.test(salesSql))
  errors.push("vendas: autoria do pacote vendido não está registrada");

const costingSql = readFileSync(resolve(dir, "20260908030000_atomic_simple_costing.sql"), "utf8");
if (!/save_costing_configuration/i.test(costingSql))
  errors.push("custeio: salvamento atômico da configuração ausente");
if (!/Somente administradores podem alterar o custeio/i.test(costingSql))
  errors.push("custeio: alteração não está limitada ao administrador");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`${files.length} migrations verificadas; cadeia crítica presente.`);
