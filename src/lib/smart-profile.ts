import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ---------------- Constantes ---------------- */

export const RESTRICTIONS: { key: string; label: string; emoji: string }[] = [
  { key: "gestante", label: "Gestante", emoji: "🤰" },
  { key: "alergico", label: "Alérgico", emoji: "⚠️" },
  { key: "pele_sensivel", label: "Pele sensível", emoji: "🌡️" },
  { key: "crianca", label: "Criança", emoji: "🧒" },
  { key: "idoso", label: "Idoso", emoji: "🧓" },
  { key: "mobilidade_reduzida", label: "Mobilidade reduzida", emoji: "♿" },
  { key: "outro", label: "Outro", emoji: "📝" },
];

export const COMMUNICATION_PREFS: Record<string, string> = {
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  sms: "SMS",
  email: "E-mail",
};

export const NOTE_KINDS: Record<string, string> = {
  preference: "Preferência",
  general: "Observação geral",
  restriction: "Restrição",
};

export const DATE_KINDS: Record<string, string> = {
  birthday: "Aniversário",
  wedding: "Casamento",
  commemorative: "Data comemorativa",
  other: "Outra",
};

export const NOTE_SUGGESTIONS = [
  "Prefere atendimento pela manhã",
  "Prefere os primeiros horários",
  "Gosta de café sem açúcar",
  "Prefere ambiente silencioso",
  "Prefere água gelada",
];

/* ---------------- Tipos ---------------- */

export type SmartProfileRow = {
  customer_id: string;
  company_id: string;
  preferred_staff_id: string | null;
  communication_pref: string;
  restrictions: string[];
  general_notes: string | null;
  updated_at: string;
};

export type SmartNote = {
  id: string;
  customer_id: string;
  company_id: string;
  kind: string;
  content: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type SmartDate = {
  id: string;
  customer_id: string;
  company_id: string;
  kind: string;
  title: string | null;
  date: string;
  notes: string | null;
};

export type SmartStats = {
  firstVisit: string | null;
  lastVisit: string | null;
  totalVisits: number;
  totalSpentCents: number;
  avgTicketCents: number;
  avgReturnDays: number | null;
  favoriteService: { name: string; count: number; last: string | null } | null;
  favoriteStaff: { id: string; name: string; count: number } | null;
  lastService: string | null;
  topProducts: { name: string; qty: number }[];
};

/* ---------------- Queries ---------------- */

export function useSmartProfile(companyId: string, customerId: string | null) {
  return useQuery({
    enabled: !!customerId,
    queryKey: ["smart-profile", customerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_profiles")
        .select("*")
        .eq("customer_id", customerId!)
        .maybeSingle();
      return (data ?? null) as SmartProfileRow | null;
    },
  });
}

export function useSmartNotes(customerId: string | null) {
  return useQuery({
    enabled: !!customerId,
    queryKey: ["smart-notes", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_notes")
        .select("*")
        .eq("customer_id", customerId!)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SmartNote[];
    },
  });
}

export function useSmartDates(customerId: string | null) {
  return useQuery({
    enabled: !!customerId,
    queryKey: ["smart-dates", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_dates")
        .select("*")
        .eq("customer_id", customerId!)
        .order("date");
      if (error) throw error;
      return (data ?? []) as SmartDate[];
    },
  });
}

export function useSmartHistory(customerId: string | null) {
  return useQuery({
    enabled: !!customerId,
    queryKey: ["smart-history", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_profile_history")
        .select("*")
        .eq("customer_id", customerId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Histórico de atendimentos + estatísticas calculadas automaticamente. */
export function useSmartStats(customerId: string | null) {
  return useQuery({
    enabled: !!customerId,
    queryKey: ["smart-stats", customerId],
    queryFn: async () => {
      const { data: appts, error } = await supabase
        .from("appointments")
        .select(
          "id,starts_at,status,total_cents,discount_cents,surcharge_cents,paid_cents,payment_status,staff_id,staff(name),appointment_services(price_cents,services(name))",
        )
        .eq("customer_id", customerId!)
        .order("starts_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const list = (appts ?? []) as any[];

      const done = list.filter((a) => a.status === "completed");
      const dates = done.map((a) => new Date(a.starts_at).getTime()).sort((a, b) => a - b);

      const svcCount = new Map<string, { count: number; last: string | null }>();
      const staffCount = new Map<string, { name: string; count: number }>();
      let spent = 0;

      for (const a of done) {
        spent += (a.total_cents ?? 0) - (a.discount_cents ?? 0) + (a.surcharge_cents ?? 0);
        for (const s of a.appointment_services ?? []) {
          const name = s.services?.name;
          if (!name) continue;
          const cur = svcCount.get(name) ?? { count: 0, last: null };
          cur.count += 1;
          if (!cur.last || new Date(a.starts_at) > new Date(cur.last)) cur.last = a.starts_at;
          svcCount.set(name, cur);
        }
        if (a.staff_id) {
          const cur = staffCount.get(a.staff_id) ?? { name: a.staff?.name ?? "Profissional", count: 0 };
          cur.count += 1;
          staffCount.set(a.staff_id, cur);
        }
      }

      let avgReturnDays: number | null = null;
      if (dates.length > 1) {
        let sum = 0;
        for (let i = 1; i < dates.length; i++) sum += dates[i] - dates[i - 1];
        avgReturnDays = Math.round(sum / (dates.length - 1) / 86400000);
      }

      const favService = [...svcCount.entries()].sort((a, b) => b[1].count - a[1].count)[0];
      const favStaff = [...staffCount.entries()].sort((a, b) => b[1].count - a[1].count)[0];

      // Produtos consumidos/vendidos vinculados aos atendimentos do cliente
      let topProducts: { name: string; qty: number }[] = [];
      const apptIds = list.map((a) => a.id);
      if (apptIds.length) {
        const { data: movs } = await supabase
          .from("inventory_movements")
          .select("quantity,type,products(name)")
          .in("appointment_id", apptIds);
        const m = new Map<string, number>();
        for (const mv of (movs ?? []) as any[]) {
          const name = mv.products?.name;
          if (!name || mv.type !== "out") continue;
          m.set(name, (m.get(name) ?? 0) + Number(mv.quantity ?? 0));
        }
        topProducts = [...m.entries()]
          .map(([name, qty]) => ({ name, qty }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5);
      }

      const stats: SmartStats = {
        firstVisit: dates.length ? new Date(dates[0]).toISOString() : null,
        lastVisit: dates.length ? new Date(dates[dates.length - 1]).toISOString() : null,
        totalVisits: done.length,
        totalSpentCents: spent,
        avgTicketCents: done.length ? Math.round(spent / done.length) : 0,
        avgReturnDays,
        favoriteService: favService
          ? { name: favService[0], count: favService[1].count, last: favService[1].last }
          : null,
        favoriteStaff: favStaff ? { id: favStaff[0], name: favStaff[1].name, count: favStaff[1].count } : null,
        lastService:
          (list[0]?.appointment_services ?? []).map((s: any) => s.services?.name).filter(Boolean).join(", ") || null,
        topProducts,
      };

      return { appointments: list, stats };
    },
  });
}
