import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260901220000_prevent_concurrent_appointment_overlap.sql",
  ),
  "utf8",
);

describe("appointment overlap database guard", () => {
  it("serializa reservas do mesmo profissional", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("new.company_id::text || ':' || new.staff_id::text");
  });

  it("detecta qualquer interseção de horários ativos", () => {
    expect(migration).toContain("existing.starts_at < new.ends_at");
    expect(migration).toContain("existing.ends_at > new.starts_at");
    expect(migration).toContain("before insert or update");
  });

  it("não permite execução direta por usuários", () => {
    expect(migration).toContain(
      "revoke all on function public.prevent_appointment_overlap() from public, anon, authenticated",
    );
  });
});
