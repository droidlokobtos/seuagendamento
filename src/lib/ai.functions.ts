import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AskInput = z.object({
  company_id: z.string().uuid(),
  question: z.string().min(1).max(4000),
  history: z.array(z.object({ q: z.string().max(2000), a: z.string().max(8000) })).max(8).optional(),
});
const brl = (cents: number) => Number((cents / 100).toFixed(2));

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since90 = new Date(Date.now() - 90 * 864e5).toISOString();
    const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
    const since60 = new Date(Date.now() - 60 * 864e5).toISOString();
    const [companyRes, apptsRes, servicesRes, staffRes, financeRes, customersRes] = await Promise.all([
      supabase.from("companies").select("id,name,niche_id,city,state,short_description").eq("id", data.company_id).maybeSingle(),
      supabase.from("appointments").select("id,status,starts_at,total_cents,discount_cents,customer_id,staff_id,service_id").eq("company_id", data.company_id).gte("starts_at", since90).limit(1500),
      supabase.from("services").select("id,name,price_cents,duration_min,active").eq("company_id", data.company_id).limit(300),
      supabase.from("staff").select("id,name,active").eq("company_id", data.company_id).limit(100),
      supabase.from("financial_transactions").select("type,amount,occurred_on").eq("company_id", data.company_id).gte("occurred_on", since90.slice(0, 10)).limit(1500),
      supabase.from("customers").select("id,name,birthdate,created_at").eq("company_id", data.company_id).limit(2000),
    ]);
    const appts = apptsRes.data ?? [], services = servicesRes.data ?? [], staff = staffRes.data ?? [], customers = customersRes.data ?? [];
    const completed = appts.filter(a => a.status === "completed");
    const cancelled = appts.filter(a => ["cancelled", "canceled"].includes(a.status));
    const noShows = appts.filter(a => ["no_show", "noshow", "missed"].includes(a.status));
    const revenue90 = completed.reduce((s,a) => s + ((a.total_cents ?? 0) - (a.discount_cents ?? 0)), 0);
    const completed30 = completed.filter(a => new Date(a.starts_at) >= new Date(since30));
    const previous30 = completed.filter(a => new Date(a.starts_at) >= new Date(since60) && new Date(a.starts_at) < new Date(since30));
    const revenue30 = completed30.reduce((s,a) => s + ((a.total_cents ?? 0) - (a.discount_cents ?? 0)), 0);
    const revenuePrevious30 = previous30.reduce((s,a) => s + ((a.total_cents ?? 0) - (a.discount_cents ?? 0)), 0);
    const byWeekday: Record<number,number> = {}, byHour: Record<number,number> = {};
    const serviceStats: Record<string,{atendimentos:number;receita:number}> = {}, staffStats: Record<string,{atendimentos:number;receita:number}> = {}, lastVisit: Record<string,string> = {};
    for (const a of appts) {
      const d = new Date(a.starts_at); byWeekday[d.getDay()] = (byWeekday[d.getDay()] ?? 0) + 1; byHour[d.getHours()] = (byHour[d.getHours()] ?? 0) + 1;
      if (a.status !== "completed") continue;
      const value = (a.total_cents ?? 0) - (a.discount_cents ?? 0);
      if (a.service_id) { serviceStats[a.service_id] ??= { atendimentos:0, receita:0 }; serviceStats[a.service_id].atendimentos++; serviceStats[a.service_id].receita += value; }
      if (a.staff_id) { staffStats[a.staff_id] ??= { atendimentos:0, receita:0 }; staffStats[a.staff_id].atendimentos++; staffStats[a.staff_id].receita += value; }
      if (a.customer_id && (!lastVisit[a.customer_id] || a.starts_at > lastVisit[a.customer_id])) lastVisit[a.customer_id] = a.starts_at;
    }
    const finance = financeRes.data ?? [];
    const income = finance.filter(t => t.type === "income").reduce((s,t) => s + Number(t.amount), 0);
    const expense = finance.filter(t => t.type === "expense").reduce((s,t) => s + Number(t.amount), 0);
    const inactive = customers.filter(c => lastVisit[c.id] && new Date(lastVisit[c.id]) < new Date(since60));
    const snapshot = {
      empresa: companyRes.data, periodo_analisado_dias: 90,
      indicadores: { agendamentos:appts.length, concluidos:completed.length, cancelados:cancelled.length, faltas:noShows.length,
        taxa_conclusao_pct: appts.length ? Number((completed.length/appts.length*100).toFixed(1)) : 0,
        taxa_cancelamento_pct: appts.length ? Number((cancelled.length/appts.length*100).toFixed(1)) : 0,
        faturamento_90d_brl:brl(revenue90), faturamento_30d_brl:brl(revenue30), faturamento_30d_anterior_brl:brl(revenuePrevious30),
        crescimento_30d_pct: revenuePrevious30 ? Number(((revenue30-revenuePrevious30)/revenuePrevious30*100).toFixed(1)) : null,
        ticket_medio_brl: completed.length ? brl(revenue90/completed.length) : 0, entradas_90d_brl:brl(income), despesas_90d_brl:brl(expense), saldo_90d_brl:brl(income-expense), clientes_total:customers.length, clientes_inativos_60d:inactive.length },
      demanda:{por_dia_semana:byWeekday,por_hora:byHour},
      servicos:services.map(s => ({nome:s.name,preco_brl:brl(s.price_cents ?? 0),duracao_min:s.duration_min,ativo:s.active,atendimentos:serviceStats[s.id]?.atendimentos ?? 0,receita_brl:brl(serviceStats[s.id]?.receita ?? 0)})),
      equipe:staff.map(s => ({nome:s.name,ativo:s.active,atendimentos:staffStats[s.id]?.atendimentos ?? 0,receita_brl:brl(staffStats[s.id]?.receita ?? 0)})),
      clientes_inativos_amostra:inactive.slice(0,30).map(c => ({nome:c.name,ultima_visita:lastVisit[c.id]})),
    };
    const system = `Você é o Consultor IA do SeuAgendamento, especialista sênior em gestão de salões, barbearias, estética e negócios de serviços. Sua função é interpretar os dados reais da empresa e atuar como consultor de gestão, financeiro, marketing, retenção e operação. Responda em português do Brasil, profissionalmente e de forma prática. Baseie números exclusivamente no snapshot; nunca invente dados. Diferencie fatos, estimativas e recomendações. Em projeções, explique brevemente a base e sinalize que são estimativas. Identifique tendências, riscos e oportunidades relevantes. Priorize impacto financeiro, ocupação, retenção, ticket médio, cancelamentos/faltas e produtividade. Evite recomendar descontos sem necessidade. Se faltarem dados, diga exatamente o que falta. Não exponha IDs técnicos nem afirme que executou alterações. Quando útil organize em Diagnóstico, Evidências, Recomendações e Próxima ação, destacando no máximo 3 prioridades.`;
    const conversation = (data.history ?? []).flatMap(h => [{role:"user" as const,content:h.q},{role:"assistant" as const,content:h.a}]);
    const { callLovableAI } = await import("./ai-gateway.server");
    const answer = await callLovableAI({ messages:[{role:"system",content:system},{role:"user",content:`Dados atuais da empresa (JSON):\n${JSON.stringify(snapshot)}`},...conversation,{role:"user",content:data.question}] });
    return { answer, snapshot };
  });
