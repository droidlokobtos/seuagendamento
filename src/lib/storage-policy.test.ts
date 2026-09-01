import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260901210000_scope_company_assets_storage.sql"),
  "utf8",
);

describe("company-assets storage policies", () => {
  it("escopa leitura, escrita, alteração e exclusão pela pasta da empresa", () => {
    expect(
      migration.match(/company_id::text = \(storage\.foldername\(name\)\)\[1\]/g),
    ).toHaveLength(5);
    expect(migration).toContain("for select to authenticated");
    expect(migration).toContain("for insert to authenticated");
    expect(migration).toContain("for update to authenticated");
    expect(migration).toContain("for delete to authenticated");
  });

  it("remove as políticas antigas que liberavam o bucket inteiro", () => {
    expect(migration).toContain('drop policy if exists "authenticated read company-assets"');
    expect(migration).toContain('drop policy if exists "authenticated delete company-assets"');
  });
});
