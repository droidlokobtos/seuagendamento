
export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

/** Data civil YYYY-MM-DD no horário oficial de Brasília. */
export const saoPauloDate = (d: Date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dateBR = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR");
};

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const statusLabel: Record<string, { label: string; className: string; dot: string }> = {
  active: { label: "Ativa", className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30", dot: "bg-emerald-500" },
  due_soon: { label: "Próximo venc.", className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30", dot: "bg-amber-500" },
  overdue: { label: "Em atraso", className: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30", dot: "bg-orange-500" },
  suspended: { label: "Suspensa", className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30", dot: "bg-red-500" },
};

/**
 * Normaliza um telefone brasileiro para o formato aceito pelo WhatsApp
 * (somente dígitos, com DDI 55). Retorna "" quando não há número válido.
 */
export const waNumber = (phone: string | null | undefined) => {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("55")) return d;
  // 10 dígitos (fixo com DDD) ou 11 dígitos (celular com DDD) => falta o DDI
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
};

/** Monta o link do WhatsApp com número normalizado e texto codificado. */
export const waLink = (phone: string | null | undefined, message: string) => {
  const num = waNumber(phone);
  const text = encodeURIComponent(message);
  return num
    ? `https://api.whatsapp.com/send?phone=${num}&text=${text}`
    : `https://api.whatsapp.com/send?text=${text}`;
};
