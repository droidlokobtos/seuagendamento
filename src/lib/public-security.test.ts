import { describe, expect, it } from "vitest";
import {
  bearerToken,
  canLinkCustomerIdentity,
  fileSignatureMatchesMime,
  sameBrazilianPhone,
} from "./public-security";

describe("canLinkCustomerIdentity", () => {
  it("vincula somente quando os e-mails correspondem", () => {
    expect(canLinkCustomerIdentity("Cliente@Email.com", " cliente@email.com ")).toBe(true);
    expect(canLinkCustomerIdentity("cliente@email.com", "outra@email.com")).toBe(false);
    expect(canLinkCustomerIdentity(null, "cliente@email.com")).toBe(false);
    expect(canLinkCustomerIdentity("", "")).toBe(false);
  });
});

describe("bearerToken", () => {
  it("aceita somente o formato Bearer", () => {
    expect(bearerToken("Bearer abc.def")).toBe("abc.def");
    expect(bearerToken("bearer token123")).toBe("token123");
    expect(bearerToken("Basic token123")).toBe("");
    expect(bearerToken(null)).toBe("");
  });
});

describe("sameBrazilianPhone", () => {
  it("exige o telefone brasileiro completo", () => {
    expect(sameBrazilianPhone("(17) 99999-1234", "+55 17 99999-1234")).toBe(true);
    expect(sameBrazilianPhone("(17) 99999-1234", "9999-1234")).toBe(false);
    expect(sameBrazilianPhone("(17) 99999-1234", "(18) 99999-1234")).toBe(false);
  });
});

describe("fileSignatureMatchesMime", () => {
  it("reconhece assinaturas válidas", () => {
    expect(fileSignatureMatchesMime(new Uint8Array([0xff, 0xd8, 0xff, 0x00]), "image/jpeg")).toBe(
      true,
    );
    expect(fileSignatureMatchesMime(new TextEncoder().encode("%PDF-1.7"), "application/pdf")).toBe(
      true,
    );
  });

  it("rejeita conteúdo disfarçado pelo MIME", () => {
    expect(fileSignatureMatchesMime(new TextEncoder().encode("<script>"), "application/pdf")).toBe(
      false,
    );
  });
});
