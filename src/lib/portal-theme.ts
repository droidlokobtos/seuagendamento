// Identidade visual da página pública de agendamento (por empresa).
export type PortalTheme = {
  primary: string;
  accent: string;
  button: string;
  text: string;
  bgUrl: string | null;
  bgStyle: "gradient" | "image" | "light" | "dark";
  cardStyle: "card" | "photo" | "minimal";
  highlight: "soft" | "bold" | "outline";
  slogan: string | null;
};

export const BG_STYLES = [
  { key: "gradient", label: "Degradê da marca" },
  { key: "image", label: "Imagem de fundo" },
  { key: "light", label: "Claro sofisticado" },
  { key: "dark", label: "Escuro premium" },
] as const;

export const CARD_STYLES = [
  { key: "card", label: "Cards clássicos" },
  { key: "photo", label: "Cards com destaque de foto" },
  { key: "minimal", label: "Lista minimalista" },
] as const;

export const HIGHLIGHTS = [
  { key: "soft", label: "Suave" },
  { key: "bold", label: "Marcante" },
  { key: "outline", label: "Contornado" },
] as const;

export function portalTheme(company: any): PortalTheme {
  const primary = company?.primary_color || "#0f172a";
  const accent = company?.secondary_color || "#c9a86a";
  return {
    primary,
    accent,
    button: company?.portal_button_color || primary,
    text: company?.portal_text_color || "#0f172a",
    bgUrl: company?.portal_bg_url || company?.banner_url || null,
    bgStyle: (company?.portal_bg_style as PortalTheme["bgStyle"]) || "gradient",
    cardStyle: (company?.portal_card_style as PortalTheme["cardStyle"]) || "card",
    highlight: (company?.portal_highlight as PortalTheme["highlight"]) || "soft",
    slogan: company?.portal_slogan || null,
  };
}

/** Fundo do topo (hero) conforme o estilo escolhido. */
export function heroBackground(t: PortalTheme): React.CSSProperties {
  switch (t.bgStyle) {
    case "light":
      return { background: `linear-gradient(135deg, #ffffff, ${t.accent}22)` };
    case "dark":
      return { background: `linear-gradient(135deg, #0b0b0d, ${t.primary})` };
    case "image":
      return { background: `linear-gradient(135deg, ${t.primary}, ${t.accent})` };
    default:
      return { background: `linear-gradient(135deg, ${t.primary}, ${t.accent})` };
  }
}

export function heroTextClass(t: PortalTheme) {
  return t.bgStyle === "light" ? "text-slate-900" : "text-white";
}

/** Opacidade da imagem sobre o fundo. */
export function heroImageOpacity(t: PortalTheme) {
  return t.bgStyle === "image" ? 0.75 : 0.4;
}

export function highlightStyle(t: PortalTheme): React.CSSProperties {
  switch (t.highlight) {
    case "bold":
      return { background: t.accent, color: "#fff", borderColor: t.accent };
    case "outline":
      return { background: "transparent", color: t.primary, borderColor: t.accent, borderWidth: 1 };
    default:
      return { background: `${t.accent}18`, color: t.primary, borderColor: `${t.accent}55` };
  }
}
