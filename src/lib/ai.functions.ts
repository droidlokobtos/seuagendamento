import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AskInput = z.object({
  company_id: z.string().uuid(),
  question: z.string().min(1).max(2000),
});

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Fetch a compact business snapshot (RLS scopes to companies the user belongs to)
    const [companyRes, apptsRes, servicesRes, staffRes, financeRes, customersRes] = await Promise.all([
      supabase.from("companies").select("id,name,niche_id,city,state,short_description").eq("id", data.company_id).maybeSingle(),
      supabase.from("appointments").select("id,status,starts_at,total_cents,discount_cents").eq("company_id", data.company_id).gte("starts_at", new Date(Date.now() - 90 * 864e5).toISOString()).limit(500),
      supabase.from("services").select("id,name,price_cents,duration_min").eq("company_id", data.company_id).limit(100),
      supabase.from("staff").select("id,name").eq("company_id", data.company_id).limit(50),
      supabase.from("financial_transactions").select("type,amount_cents,occurred_at").eq("company_id", data.company_id).gte("occurred_at", new Date(Date.now() - 90 * 864e5).toISOString()).limit(500),
      supabase.from("customers").select("id,birthdate").eq("company_id", data.company_id).limit(500),
    ]);

    const appts = apptsRes.data ?? [];
    const completed = appts.filter((a) => a.status === "completed");
    const revenue90 = completed.reduce((s, a) => s + (a.total_cents - (a.discount_cents ?? 0)), 0);
    const ticketAvg = completed.length ? revenue90 / completed.length : 0;

    const byWeekday: Record<number, number> = {};
    const byHour: Record<number, number> = {};
    for (const a of appts) {
      const d = new Date(a.starts_at);
      byWeekday[d.getDay()] = (byWeekday[d.getDay()] ?? 0) + 1;
      byHour[d.getHours()] = (byHour[d.getHours()] ?? 0) + 1;
    }

    const income = (financeRes.data ?? []).filter((t) => t.type === "income").reduce((s, t) => s + t.amount_cents, 0);
    const expense = (financeRes.data ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount_cents, 0);

    const snapshot = {
      empresa: companyRes.data,
      periodo_dias: 90,
      agendamentos_total: appts.length,
      agendamentos_concluidos: completed.length,
      faturamento_90d_brl: (revenue90 / 100).toFixed(2),
      ticket_medio_brl: (ticketAvg / 100).toFixed(2),
      caixa_90d_brl: ((income - expense) / 100).toFixed(2),
      distribuicao_por_dia_semana: byWeekday,
      distribuicao_por_hora: byHour,
      total_clientes: (customersRes.data ?? []).length,
      servicos: (servicesRes.data ?? []).map((s) => ({ nome: s.name, preco_brl: s.price_cents / 100, min: s.duration_min })),
      funcionarios: (staffRes.data ?? []).map((s) => s.name),
    };

    const system = `Você é o assistente inteligente de uma plataforma de agendamento para negócios de beleza.
Responda em português do Brasil, de forma direta, prática e acionável.
Use os dados fornecidos no snapshot para fundamentar sugestões (horários com maior demanda, previsão de faturamento com base nos últimos 90 dias, clientes inativos, oportunidades de upsell, campanhas).
Quando fizer projeções, deixe claro que são estimativas baseadas no histórico.`;

    const { callLovableAI } = await import("./ai-gateway.server");
    const answer = await callLovableAI({
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Snapshot da empresa (JSON):\n${JSON.stringify(snapshot)}\n\nPergunta: ${data.question}` },
      ],
    });

    return { answer, snapshot };
  });
