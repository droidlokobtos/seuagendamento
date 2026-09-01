import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve("supabase/migrations/20260901224500_enforce_financial_rpc_permissions.sql"),
  "utf8",
).toLowerCase();

describe("financial RPC permissions migration", () => {
  it("requires granular permissions for expense and checkout operations", () => {
    expect(sql).toContain("has_any_permission(v_company_id, array['financeiro'])");
    expect(sql).toContain("has_any_permission(v_company_id, array['caixa', 'financeiro'])");
    expect(sql).toContain("has_any_permission(v_company_id, array['estoque'])");
  });

  it("removes authenticated access to the unguarded RPCs", () => {
    expect(sql).toMatch(
      /revoke all on function public\.mark_business_expense_paid\([^)]+\) from public, authenticated/,
    );
    expect(sql).toMatch(
      /revoke all on function public\.checkout_appointment_with_products\([^)]+\) from public, authenticated/,
    );
  });
});
