import { waNumber } from "./format";

export const bearerToken = (authorization: string | null | undefined) => {
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization?.trim() ?? "");
  return match?.[1] ?? "";
};

export const sameBrazilianPhone = (
  stored: string | null | undefined,
  supplied: string | null | undefined,
) => {
  const expected = waNumber(stored);
  const received = waNumber(supplied);
  return Boolean(expected && received && expected === received);
};

export const fileSignatureMatchesMime = (bytes: Uint8Array, mime: string) => {
  if (mime === "image/png") {
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  }
  if (mime === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === "image/webp") {
    const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
    return bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  }
  if (mime === "application/pdf") {
    return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  }
  return false;
};
