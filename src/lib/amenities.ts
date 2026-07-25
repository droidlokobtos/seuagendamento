import { Wifi, Accessibility, Baby, Snowflake, type LucideIcon } from "lucide-react";

export type Amenity = {
  key: string;
  /** Rótulo curto exibido no perfil público */
  label: string;
  /** Descrição usada no painel de configurações */
  description: string;
  icon: LucideIcon;
  emoji: string;
};

/** Para adicionar um novo benefício, basta incluir um item nesta lista. */
export const AMENITIES: Amenity[] = [
  { key: "wifi", label: "Wi-Fi", description: "Wi-Fi disponível", icon: Wifi, emoji: "📶" },
  { key: "accessibility", label: "Acessível", description: "Acessibilidade", icon: Accessibility, emoji: "♿" },
  { key: "kids", label: "Espaço para crianças", description: "Atende crianças", icon: Baby, emoji: "👧" },
  { key: "air_conditioning", label: "Ambiente climatizado", description: "Ar condicionado", icon: Snowflake, emoji: "❄️" },
];

export function getAmenities(keys: unknown): Amenity[] {
  if (!Array.isArray(keys)) return [];
  return AMENITIES.filter((a) => keys.includes(a.key));
}
