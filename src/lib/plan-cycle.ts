export const PLAN_CYCLE_OPTIONS = [1, 3, 6, 12] as const;

export type PlanCycleMonths = (typeof PLAN_CYCLE_OPTIONS)[number];

type PlanCyclePriceInput = {
  monthlyCents: number;
  months: PlanCycleMonths;
  discountPercent?: number | null;
  configuredMonthlyCents?: number | null;
  configuredMonths?: number | null;
  configuredTotalCents?: number | null;
};

export function calculatePlanCyclePrice({
  monthlyCents,
  months,
  discountPercent,
  configuredMonthlyCents,
  configuredMonths,
  configuredTotalCents,
}: PlanCyclePriceInput) {
  const safeMonthlyCents = Math.max(0, Math.round(monthlyCents));
  if (months === 1) return { totalCents: safeMonthlyCents, discountPercent: 0 };

  const safeDiscount = Math.min(100, Math.max(0, Number(discountPercent ?? 0)));
  const usesConfiguredTotal =
    configuredMonths === months &&
    configuredTotalCents != null &&
    configuredMonthlyCents === safeMonthlyCents;

  return {
    totalCents: usesConfiguredTotal
      ? Math.max(0, Math.round(configuredTotalCents))
      : Math.round(safeMonthlyCents * months * (1 - safeDiscount / 100)),
    discountPercent: safeDiscount,
  };
}
