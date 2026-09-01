import { describe, expect, it } from "vitest";
import { waLink, waNumber } from "./format";

describe("waNumber", () => {
  it("normaliza celular brasileiro com máscara", () => {
    expect(waNumber("(17) 99999-9999")).toBe("5517999999999");
  });

  it("mantém o DDI brasileiro", () => {
    expect(waNumber("+55 17 99999-9999")).toBe("5517999999999");
  });

  it("remove o zero de operadora antes do DDD", () => {
    expect(waNumber("017999999999")).toBe("5517999999999");
  });

  it("rejeita número incompleto", () => {
    expect(waNumber("9999-9999")).toBe("");
  });
});

describe("waLink", () => {
  it("gera um link único e codifica a mensagem", () => {
    expect(waLink("(17) 99999-9999", "Olá cliente")).toBe(
      "https://wa.me/5517999999999?text=Ol%C3%A1%20cliente",
    );
  });
});
