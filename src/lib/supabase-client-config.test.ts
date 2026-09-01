import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const client = readFileSync(resolve("src/integrations/supabase/client.ts"), "utf8");

describe("Supabase browser configuration", () => {
  it("has a public fallback for hosts without Vite environment injection", () => {
    expect(client).toContain("FALLBACK_SUPABASE_URL");
    expect(client).toContain("FALLBACK_SUPABASE_ANON_KEY");
    expect(client).toContain("ggewrcbiqfnpmlzgwqqe.supabase.co");
  });

  it("still prioritizes environment-provided values", () => {
    expect(client.indexOf("import.meta.env.VITE_SUPABASE_URL")).toBeLessThan(
      client.indexOf("FALLBACK_SUPABASE_URL;"),
    );
  });
});
