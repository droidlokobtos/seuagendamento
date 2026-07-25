/**
 * Metadados centralizados dos status de agendamento.
 * Adicione novos status aqui — todas as telas leem desta configuração.
 */
export type AppointmentStatus =
  | "scheduled"
  | "reminder_sent"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "cancelled_by_customer"
  | "cancelled_by_company"
  | "no_show";

export const APPOINTMENT_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  scheduled: {
    label: "Agendado",
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    dot: "bg-blue-500",
  },
  reminder_sent: {
    label: "Lembrete enviado",
    color: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    dot: "bg-sky-500",
  },
  confirmed: {
    label: "Confirmado",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  in_progress: {
    label: "Em atendimento",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dot: "bg-amber-500",
  },
  completed: {
    label: "Concluído",
    color: "bg-primary/15 text-primary border-primary/30",
    dot: "bg-primary",
  },
  cancelled: {
    label: "Cancelado",
    color: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    dot: "bg-red-500",
  },
  cancelled_by_customer: {
    label: "Cancelado pelo cliente",
    color: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    dot: "bg-rose-500",
  },
  cancelled_by_company: {
    label: "Cancelado pela empresa",
    color: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    dot: "bg-orange-500",
  },
  no_show: {
    label: "Faltou",
    color: "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300 border-neutral-500/30",
    dot: "bg-neutral-500",
  },
};

export const statusMeta = (s: string | null | undefined) =>
  APPOINTMENT_STATUS[s ?? ""] ?? {
    label: s ?? "—",
    color: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  };

/** Status que liberam o horário na agenda. */
export const FREED_STATUSES = ["cancelled", "cancelled_by_customer", "cancelled_by_company", "no_show"];
