import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260901223000_harden_identity_helper_functions.sql"),
  "utf8",
);

describe("identity SECURITY DEFINER helpers", () => {
  it("permite consulta própria ou do Admin Master", () => {
    expect(migration.match(/_user_id = auth\.uid\(\)/g)).toHaveLength(2);
    expect(migration.match(/admin_role\.role = 'super_admin'/g)).toHaveLength(2);
  });

  it("remove execução anônima", () => {
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated, service_role");
  });

  it("mantém search_path explícito", () => {
    expect(migration.match(/set search_path = public/g)).toHaveLength(2);
  });
});
