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

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`${files.length} migrations verificadas; cadeia crítica presente.`);
