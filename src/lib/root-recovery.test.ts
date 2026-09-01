import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rootRoute = readFileSync(resolve("src/routes/__root.tsx"), "utf8");

describe("root error recovery", () => {
  it("clears browser caches and forces a cache-busted navigation", () => {
    expect(rootRoute).toContain("window.caches.delete");
    expect(rootRoute).toContain('url.searchParams.set("__recovery"');
    expect(rootRoute).toContain("window.location.replace");
  });

  it("guards automatic recovery against reload loops", () => {
    expect(rootRoute).toContain("alreadyRecovered");
    expect(rootRoute).toContain("Date.now() - lastRecovery < 30_000");
  });
});
