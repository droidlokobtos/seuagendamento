import { describe, expect, it } from "vitest";
import { calculatePlanCyclePrice } from "./plan-cycle";

describe("calculatePlanCyclePrice", () => {
  it("cobra uma mensalidade sem desconto no ciclo de um mês", () => {
    expect(calculatePlanCyclePrice({ monthlyCents: 10990, months: 1, discountPercent: 5 })).toEqual(
      {
        totalCents: 10990,
        discountPercent: 0,
      },
    );
  });

  it("usa o total especial configurado para o ciclo padrão", () => {
    expect(
      calculatePlanCyclePrice({
        monthlyCents: 10990,
        months: 12,
        discountPercent: 5,
        configuredMonthlyCents: 10990,
        configuredMonths: 12,
        configuredTotalCents: 125286,
      }).totalCents,
    ).toBe(125286);
  });

  it("recalcula o total quando o Admin Master personaliza a mensalidade", () => {
    expect(
      calculatePlanCyclePrice({
        monthlyCents: 10000,
        months: 3,
        discountPercent: 5,
        configuredMonthlyCents: 10990,
        configuredMonths: 12,
        configuredTotalCents: 125286,
      }).totalCents,
    ).toBe(28500);
  });
});
