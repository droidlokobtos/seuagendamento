/**
 * Configuração central das dimensões de imagem da aplicação.
 * Para mudar o tamanho exigido de um campo, altere APENAS este arquivo.
 */
export type ImagePreset = {
  /** Largura exigida em pixels */
  width: number;
  /** Altura exigida em pixels */
  height: number;
  /** Rótulo amigável do campo */
  label: string;
  /** Tamanho máximo do arquivo em MB */
  maxSizeMB?: number;
  /** Tolerância em pixels aceita na validação (0 = tamanho exato) */
  tolerance?: number;
};

export const IMAGE_PRESETS = {
  logo: { label: "Logo", width: 512, height: 512 },
  avatar: { label: "Foto de perfil", width: 400, height: 400 },
  banner: { label: "Banner", width: 1200, height: 300 },
  cover: { label: "Foto de capa", width: 223, height: 455 },
  app_icon: { label: "Ícone do app", width: 512, height: 512 },
  service: { label: "Foto do serviço", width: 1200, height: 675 },
  gallery: { label: "Foto da galeria", width: 1080, height: 1080 },
} satisfies Record<string, ImagePreset>;

export type ImagePresetKey = keyof typeof IMAGE_PRESETS;

export function getPreset(key: ImagePresetKey): ImagePreset {
  return IMAGE_PRESETS[key];
}

export function presetHint(p: ImagePreset) {
  return `Tamanho recomendado: ${p.width} × ${p.height} px`;
}

export function presetError(p: ImagePreset, w: number, h: number) {
  return `A imagem deve ter exatamente ${p.width} × ${p.height} pixels (enviada: ${w} × ${h}).`;
}

export function dimensionsMatch(p: ImagePreset, w: number, h: number) {
  const t = p.tolerance ?? 0;
  return Math.abs(w - p.width) <= t && Math.abs(h - p.height) <= t;
}

/** Lê largura/altura de PNG, JPEG, WebP e GIF a partir dos bytes (uso no servidor). */
export function readImageSize(buf: Uint8Array): { width: number; height: number } | null {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // PNG
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  // GIF
  if (buf.length > 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: dv.getUint16(6, true), height: dv.getUint16(8, true) };
  }
  // WebP
  if (
    buf.length > 30 &&
    String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) === "RIFF" &&
    String.fromCharCode(buf[8], buf[9], buf[10], buf[11]) === "WEBP"
  ) {
    const fmt = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
    if (fmt === "VP8 ") return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
    if (fmt === "VP8L") {
      const b = dv.getUint32(21, true);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    if (fmt === "VP8X") {
      const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
      const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
      return { width: w, height: h };
    }
  }
  // JPEG
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = dv.getUint16(i + 2);
      const isSOF =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}
