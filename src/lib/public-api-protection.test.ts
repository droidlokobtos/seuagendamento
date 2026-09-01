import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hashPublicValue, requestFingerprint } from "@/lib/public-api-protection.server";

const migration = readFileSync(
  resolve("supabase/migrations/20260901230000_public_api_protection_and_observability.sql"),
  "utf8",
).toLowerCase();

describe("public API protection", () => {
  it("creates stable hashes without retaining personal values", () => {
    expect(hashPublicValue("5517999999999")).toHaveLength(64);
    expect(hashPublicValue("5517999999999")).toBe(hashPublicValue("5517999999999"));
    expect(hashPublicValue("5517999999999")).not.toContain("99999999");
  });

  it("fingerprints the request from proxy IP and user agent", () => {
    const request = new Request("https://example.test", {
      headers: { "cf-connecting-ip": "203.0.113.10", "user-agent": "test-agent" },
    });
    expect(requestFingerprint(request)).toHaveLength(64);
  });

  it("locks protection tables and functions to the service role", () => {
    expect(migration).toContain("public.public_api_rate_limits");
    expect(migration).toContain("public.public_client_verifications");
    expect(migration).toContain("public.public_api_events");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
