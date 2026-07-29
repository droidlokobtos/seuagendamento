/**
 * Regra financeira única do sistema.
 *
 * TODOS os módulos (agendamento, portal público, caixa, comissões, relatórios)
 * devem calcular valores exclusivamente por estas funções. Nenhum módulo pode
 * ter regra própria — assim não existe divergência entre telas.
 *
 * Toda a base de cálculo é em CENTAVOS (inteiros), evitando erro de ponto
 * flutuante. A conversão para reais acontece só na exibição (`brl`).
 */

export type DepositType = "percent" | "fixed";

export type DepositConfig = {
  enabled: boolean;
  type: DepositType;
  /** percentual (0–100) quando type = 'percent'; reais quando type = 'fixed' */
  value: number;
};

export type PaymentKind = "deposit" | "final" | "extra" | "refund";
export type PaymentStatus = "pending" | "approved" | "rejected";
export type AppointmentPaymentStatus =
  | "pending"
  | "awaiting_approval"
  | "deposit_paid"
  | "paid"
  | "refunded";

export type FinanceInput = {
  /** soma dos serviços no momento do agendamento (valor contratado) */
  subtotalCents: number;
  discountCents?: number;
  surchargeCents?: number;
  /** soma dos pagamentos aprovados (sinal + final + extras − estornos) */
  paidCents?: number;
  depositRequiredCents?: number;
};

export type FinanceResult = {
  subtotalCents: number;
  discountCents: number;
  surchargeCents: number;
  /** valor total devido do atendimento */
  totalCents: number;
  paidCents: number;
  /** saldo restante a receber (nunca negativo) */
  balanceCents: number;
  depositRequiredCents: number;
  /** quanto ainda falta do sinal */
  depositDueCents: number;
  fullyPaid: boolean;
};

const int = (n: number | null | undefined) => Math.round(Number(n ?? 0)) || 0;

/** Cálculo financeiro central de um atendimento. */
export function computeFinance(input: FinanceInput): FinanceResult {
  const subtotalCents = Math.max(0, int(input.subtotalCents));
  const discountCents = Math.max(0, int(input.discountCents));
  const surchargeCents = Math.max(0, int(input.surchargeCents));
  const paidCents = int(input.paidCents);
  const totalCents = Math.max(0, subtotalCents - discountCents + surchargeCents);
  const depositRequiredCents = Math.min(Math.max(0, int(input.depositRequiredCents)), totalCents);
  return {
    subtotalCents,
    discountCents,
    surchargeCents,
    totalCents,
    paidCents,
    balanceCents: Math.max(0, totalCents - paidCents),
    depositRequiredCents,
    depositDueCents: Math.max(0, depositRequiredCents - paidCents),
    fullyPaid: totalCents > 0 && paidCents >= totalCents,
  };
}

/** Valor do sinal exigido para um total, conforme configuração da empresa. */
export function computeDepositCents(totalCents: number, cfg: DepositConfig | null | undefined): number {
  if (!cfg?.enabled) return 0;
  const total = Math.max(0, int(totalCents));
  if (total === 0) return 0;
  const value = Number(cfg.value ?? 0);
  if (!(value > 0)) return 0;
  const raw =
    cfg.type === "fixed"
      ? Math.round(value * 100)
      : Math.round((total * Math.min(value, 100)) / 100);
  return Math.max(0, Math.min(raw, total));
}

/** Comissão de um serviço (regra do serviço ou percentual do profissional). */
export function commissionCents(
  serviceCents: number,
  type: "fixed" | "percent" | null | undefined,
  value: number | null | undefined,
): number {
  const v = Number(value ?? 0);
  if (!(v > 0)) return 0;
  if (type === "fixed") return Math.round(v * 100);
  return Math.round((Math.max(0, int(serviceCents)) * v) / 100);
}

/** Lê a configuração de sinal a partir do registro da empresa. */
export function depositConfigFromCompany(c: any): DepositConfig {
  return {
    enabled: !!c?.deposit_enabled,
    type: (c?.deposit_type === "fixed" ? "fixed" : "percent") as DepositType,
    value: Number(c?.deposit_value ?? 0),
  };
}

export const PAYMENT_STATUS_META: Record<
  AppointmentPaymentStatus,
  { label: string; className: string }
> = {
  pending: { label: "Pagamento pendente", className: "bg-muted text-muted-foreground" },
  awaiting_approval: { label: "Aguardando confirmação do pagamento", className: "bg-amber-100 text-amber-800" },
  deposit_paid: { label: "Reserva confirmada (sinal pago)", className: "bg-sky-100 text-sky-800" },
  paid: { label: "Pago integralmente", className: "bg-emerald-100 text-emerald-800" },
  refunded: { label: "Estornado", className: "bg-rose-100 text-rose-800" },
};

export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  deposit: "Sinal (antecipado)",
  final: "Pagamento final",
  extra: "Acréscimo",
  refund: "Estorno",
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  appointment_created: "Agendamento criado",
  appointment_status: "Alteração de status",
  deposit_submitted: "Comprovante de sinal enviado",
  payment_created: "Pagamento registrado",
  payment_approved: "Pagamento aprovado",
  payment_rejected: "Pagamento rejeitado",
  payment_pending: "Pagamento pendente",
  payment_deleted: "Pagamento removido",
  commission_generated: "Comissão calculada",
};
