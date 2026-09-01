import { describe, expect, it } from "vitest";
import { normalizeIdentityName } from "@/routes/api/public/anamnesis";

describe("public anamnesis identity", () => {
  it("normalizes accents, case and repeated spaces", () => {
    expect(normalizeIdentityName("  JOÃO   da SILVA ")).toBe("joao da silva");
  });

  it("does not collapse different customer names", () => {
    expect(normalizeIdentityName("Maria Souza")).not.toBe(normalizeIdentityName("Marina Souza"));
  });
});
