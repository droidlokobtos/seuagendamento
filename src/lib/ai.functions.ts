import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AskInput = z.object({
  company_id: z.string().uuid(),
  question: z.string().min(1).max(4000),
  history: z.array(z.object({ q: z.string().max(2000), a: z.string().max(8000) })).max(8).optional(),
});

const IntelInput = z.object({ company_id: z.string().uuid() });
const brl = (cents: number) => Number((cents / 100).toFixed(2));
const pct = (n: number) => Number(n.toFixed(1));
const DAY = 864e5;

async function buildBusinessIntelligence(supabase: any, companyId: string) {
  const now = new Date();
  const since180 = new Date(now.getTime() - 180 * DAY).toISOString();
  const since90 = new Date(now.getTime() - 90 * DAY).toISOString();
  const since60 = new Date(now.getTime() - 60 * DAY).toISOString();
  const since30 = new Date(now.getTime() - 30 * DAY).toISOString();

  const [companyRes, apptsRes, servicesRes, staffRes, financeRes, customersRes] = await Promise.all([
    supabase.from("companies").select("id,name,niche_id,city,state,short_description").eq("id", companyId).maybeSingle(),
    supabase.from("appointments").select("id,status,starts_at,total_cents,discount_cents,customer_id,staff_id,service_id").eq("company_id", companyId).gte("starts_at", since180).order("starts_at", { ascending: true }).limit(3000),
    supabase.from("services").select("id,name,price_cents,duration_min,active").eq("company_id", companyId).limit(300),
    supabase.from("staff").select("id,name,active").eq("company_id", companyId).limit(100),
    supabase.from("financial_transactions").select("type,amount,occurred_on").eq("company_id", companyId).gte("occurred_on", since90.slice(0, 10)).limit(1500),
    supabase.from("customers").select("id,name,birthdate,created_at").eq("company_id", companyId).limit(2500),
  ]);

  const appts = apptsRes.data ?? [];
  const appts90 = appts.filter((a: any) => new Date(a.starts_at) >= new Date(since90));
  const services = servicesRes.data ?? [];
  const staff = staffRes.data ?? [];
  const customers = customersRes.data ?? [];
  const completed = appts90.filter((a: any) => a.status === "completed");
  const completed180 = appts.filter((a: any) => a.status === "completed");
  const cancelled = appts90.filter((a: any) => ["cancelled", "cancelled_by_customer", "cancelled_by_company", "canceled"].includes(a.status));
  const noShows = appts90.filter((a: any) => ["no_show", "noshow", "missed"].includes(a.status));

  const revenueOf = (items: any[]) => items.reduce((s, a) => s + ((a.total_cents ?? 0) - (a.discount_cents ?? 0)), 0);
  const revenue90 = revenueOf(completed);
  const completed30 = completed180.filter((a: any) => new Date(a.starts_at) >= new Date(since30));
  const previous30 = completed180.filter((a: any) => new Date(a.starts_at) >= new Date(since60) && new Date(a.starts_at) < new Date(since30));
  const revenue30 = revenueOf(completed30);
  const revenuePrevious30 = revenueOf(previous30);
  const growth30 = revenuePrevious30 ? ((revenue30 - revenuePrevious30) / revenuePrevious30) * 100 : null;

  const byWeekday: Record<number, number> = {};
  const byHour: Record<number, number> = {};
  const serviceStats: Record<string, { atendimentos: number; receita: number }> = {};
  const staffStats: Record<string, { atendimentos: number; receita: number }> = {};
  const customerVisits: Record<string, string[]> = {};

  for (const a of appts90) {
    const d = new Date(a.starts_at);
    byWeekday[d.getDay()] = (byWeekday[d.getDay()] ?? 0) + 1;
    byHour[d.getHours()] = (byHour[d.getHours()] ?? 0) + 1;
    if (a.status !== "completed") continue;
    const value = (a.total_cents ?? 0) - (a.discount_cents ?? 0);
    if (a.service_id) {
      serviceStats[a.service_id] ??= { atendimentos: 0, receita: 0 };
      serviceStats[a.service_id].atendimentos++;
      serviceStats[a.service_id].receita += value;
    }
    if (a.staff_id) {
      staffStats[a.staff_id] ??= { atendimentos: 0, receita: 0 };
      staffStats[a.staff_id].atendimentos++;
      staffStats[a.staff_id].receita += value;
    }
  }

  for (const a of completed180) {
    if (!a.customer_id) continue;
    customerVisits[a.customer_id] ??= [];
    customerVisits[a.customer_id].push(a.starts_at);
  }

  const finance = financeRes.data ?? [];
  const income = finance.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const expense = finance.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);

  const customerMap = new Map(customers.map((c: any) => [c.id, c]));
  const riskCustomers = Object.entries(customerVisits).flatMap(([customerId, visits]) => {
    const sorted = visits.map(v => new Date(v).getTime()).sort((a, b) => a - b);
    if (sorted.length < 2) return [];
    const intervals = sorted.slice(1).map((t, i) => (t - sorted[i]) / DAY);
    const avgInterval = intervals.reduce((s, n) => s + n, 0) / intervals.length;
    const daysSinceLast = (now.getTime() - sorted[sorted.length - 1]) / DAY;
    const overdueDays = daysSinceLast - avgInterval;
    const ratio = avgInterval > 0 ? daysSinceLast / avgInterval : 0;
    if (ratio < 1.2 || overdueDays < 5) return [];
    const customer: any = customerMap.get(customerId);
    const score = Math.min(100, Math.round(45 + (ratio - 1) * 45 + Math.min(sorted.length, 6) * 2));
    return [{
      customer_id: customerId,
      nome: customer?.name ?? "Cliente",
      visitas_180d: sorted.length,
      frequencia_media_dias: Math.round(avgInterval),
      dias_desde_ultima_visita: Math.round(daysSinceLast),
      atraso_estimado_dias: Math.max(0, Math.round(overdueDays)),
      risco_score: score,
      nivel: score >= 80 ? "alto" : score >= 65 ? "medio" : "atencao",
      ultima_visita: new Date(sorted[sorted.length - 1]).toISOString(),
    }];
  }).sort((a, b) => b.risco_score - a.risco_score);

  const inactive = customers.filter((c: any) => {
    const visits = customerVisits[c.id];
    if (!visits?.length) return false;
    return new Date(visits[visits.length - 1]) < new Date(since60);
  });

  const avgDaily30 = revenue30 / 30;
  const avgDailyPrev = revenuePrevious30 / 30;
  const weightedDaily = revenuePrevious30 > 0 ? avgDaily30 * 0.7 + avgDailyPrev * 0.3 : avgDaily30;
  const projected30 = Math.max(0, Math.round(weightedDaily * 30));
  const forecastConfidence = completed30.length >= 30 ? "alta" : completed30.length >= 10 ? "media" : "baixa";

  const weekdayEntries = Object.entries(byWeekday).map(([day, count]) => ({ day: Number(day), count })).sort((a, b) => a.count - b.count);
  const weakestDay = weekdayEntries[0] ?? null;
  const strongestDay = weekdayEntries[weekdayEntries.length - 1] ?? null;
  const weekdayNames = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

  const alerts: Array<{ id: string; severity: "critical" | "attention" | "opportunity" | "positive"; title: string; description: string; metric?: string; action: string }> = [];
  if (growth30 !== null && growth30 <= -10) alerts.push({ id: "revenue_drop", severity: "critical", title: "Queda relevante de faturamento", description: `O faturamento dos últimos 30 dias caiu ${Math.abs(pct(growth30))}% em relação aos 30 dias anteriores.`, metric: `${pct(growth30)}%`, action: "Analisar causas e criar plano de recuperação" });
  else if (growth30 !== null && growth30 >= 10) alerts.push({ id: "revenue_growth", severity: "positive", title: "Faturamento em crescimento", description: `O faturamento dos últimos 30 dias cresceu ${pct(growth30)}% em relação ao período anterior.`, metric: `+${pct(growth30)}%`, action: "Identificar os fatores que mais contribuíram" });

  const cancellationRate = appts90.length ? (cancelled.length / appts90.length) * 100 : 0;
  const noShowRate = appts90.length ? (noShows.length / appts90.length) * 100 : 0;
  if (cancellationRate >= 12) alerts.push({ id: "cancellations", severity: "attention", title: "Cancelamentos acima do desejável", description: `${pct(cancellationRate)}% dos agendamentos analisados foram cancelados.`, metric: `${pct(cancellationRate)}%`, action: "Revisar confirmação, antecedência e política de cancelamento" });
  if (noShowRate >= 5) alerts.push({ id: "no_show", severity: "attention", title: "Faltas merecem atenção", description: `${pct(noShowRate)}% dos agendamentos resultaram em falta.`, metric: `${pct(noShowRate)}%`, action: "Reforçar lembretes e identificar clientes recorrentes em faltas" });
  if (riskCustomers.length > 0) alerts.push({ id: "client_risk", severity: riskCustomers.length >= 10 ? "critical" : "opportunity", title: "Clientes com risco de não retornar", description: `${riskCustomers.length} cliente(s) ultrapassaram a frequência habitual de retorno.`, metric: String(riskCustomers.length), action: "Priorizar recuperação dos clientes de maior risco" });
  if (weakestDay && strongestDay && strongestDay.count >= weakestDay.count * 1.8) alerts.push({ id: "weak_day", severity: "opportunity", title: "Oportunidade de ocupação na agenda", description: `${weekdayNames[weakestDay.day]} apresenta demanda bem menor que ${weekdayNames[strongestDay.day]}.`, metric: `${weakestDay.count} vs ${strongestDay.count}`, action: `Criar ações específicas para ${weekdayNames[weakestDay.day]}` });
  if (alerts.length === 0) alerts.push({ id: "stable", severity: "positive", title: "Operação sem alertas críticos", description: "Os principais indicadores analisados não apresentam desvios relevantes neste momento.", action: "Acompanhar tendências e oportunidades semanalmente" });

  const snapshot = {
    empresa: companyRes.data,
    periodo_analisado_dias: 90,
    indicadores: {
      agendamentos: appts90.length,
      concluidos: completed.length,
      cancelados: cancelled.length,
      faltas: noShows.length,
      taxa_conclusao_pct: appts90.length ? pct((completed.length / appts90.length) * 100) : 0,
      taxa_cancelamento_pct: pct(cancellationRate),
      taxa_faltas_pct: pct(noShowRate),
      faturamento_90d_brl: brl(revenue90),
      faturamento_30d_brl: brl(revenue30),
      faturamento_30d_anterior_brl: brl(revenuePrevious30),
      crescimento_30d_pct: growth30 === null ? null : pct(growth30),
      ticket_medio_brl: completed.length ? brl(revenue90 / completed.length) : 0,
      entradas_90d_brl: brl(income),
      despesas_90d_brl: brl(expense),
      saldo_90d_brl: brl(income - expense),
      clientes_total: customers.length,
      clientes_inativos_60d: inactive.length,
      clientes_em_risco: riskCustomers.length,
    },
    demanda: { por_dia_semana: byWeekday, por_hora: byHour },
    servicos: services.map((s: any) => ({ nome: s.name, preco_brl: brl(s.price_cents ?? 0), duracao_min: s.duration_min, ativo: s.active, atendimentos: serviceStats[s.id]?.atendimentos ?? 0, receita_brl: brl(serviceStats[s.id]?.receita ?? 0) })),
    equipe: staff.map((s: any) => ({ nome: s.name, ativo: s.active, atendimentos: staffStats[s.id]?.atendimentos ?? 0, receita_brl: brl(staffStats[s.id]?.receita ?? 0) })),
    clientes_inativos_amostra: inactive.slice(0, 30).map((c: any) => ({ nome: c.name, ultima_visita: customerVisits[c.id]?.at(-1) ?? null })),
  };

  return {
    snapshot,
    intelligence: {
      generated_at: now.toISOString(),
      radar: alerts.slice(0, 8),
      forecast: {
        periodo: "proximos_30_dias",
        faturamento_previsto_brl: brl(projected30),
        faturamento_ultimos_30d_brl: brl(revenue30),
        faturamento_30d_anterior_brl: brl(revenuePrevious30),
        tendencia_pct: growth30 === null ? null : pct(growth30),
        confianca: forecastConfidence,
        metodologia: "Média diária ponderada: 70% dos últimos 30 dias e 30% dos 30 dias anteriores.",
      },
      customers_at_risk: riskCustomers.slice(0, 40),
      proactive_summary: {
        critical_count: alerts.filter(a => a.severity === "critical").length,
        attention_count: alerts.filter(a => a.severity === "attention").length,
        opportunity_count: alerts.filter(a => a.severity === "opportunity").length,
        top_priority: alerts.find(a => a.severity === "critical") ?? alerts.find(a => a.severity === "attention") ?? alerts.find(a => a.severity === "opportunity") ?? alerts[0],
      },
    },
  };
}

export const getBusinessIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IntelInput.parse(input))
  .handler(async ({ data, context }) => buildBusinessIntelligence(context.supabase, data.company_id));

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }) => {
    const { snapshot, intelligence } = await buildBusinessIntelligence(context.supabase, data.company_id);
    const system = `Você é o Consultor IA do SeuAgendamento, especialista sênior em gestão de salões, barbearias, estética e negócios de serviços. Sua função é interpretar os dados reais da empresa e atuar como consultor de gestão, financeiro, marketing, retenção e operação. Responda em português do Brasil, profissionalmente e de forma prática. Baseie números exclusivamente nos dados fornecidos; nunca invente dados. Diferencie fatos, estimativas e recomendações. Em projeções, explique brevemente a base e sinalize que são estimativas. Identifique tendências, riscos e oportunidades relevantes. Priorize impacto financeiro, ocupação, retenção, ticket médio, cancelamentos/faltas e produtividade. Evite recomendar descontos sem necessidade. Se faltarem dados, diga exatamente o que falta. Não exponha IDs técnicos nem afirme que executou alterações. Quando útil organize em Diagnóstico, Evidências, Recomendações e Próxima ação, destacando no máximo 3 prioridades. Você também recebe Radar Inteligente, previsão e clientes em risco calculados deterministicamente pelo sistema: trate esses cálculos como evidências e não os substitua por números inventados.`;
    const conversation = (data.history ?? []).flatMap(h => [{ role: "user" as const, content: h.q }, { role: "assistant" as const, content: h.a }]);
    const { callLovableAI } = await import("./ai-gateway.server");
    const answer = await callLovableAI({ messages: [
      { role: "system", content: system },
      { role: "user", content: `Dados atuais da empresa (JSON):\n${JSON.stringify({ snapshot, intelligence })}` },
      ...conversation,
      { role: "user", content: data.question },
    ] });
    return { answer, snapshot, intelligence };
  });
