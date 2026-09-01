import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CalendarDays, DollarSign, Users, Package, Download, Printer } from "lucide-react";
import { brl, saoPauloDate } from "@/lib/format";

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "\uFEFF" + rows.map((r) => r.map(escape).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const Route = createFileRoute("/_authenticated/app/reports")({
  component: Reports,
});

function Reports() {
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const today = saoPauloDate();
  const firstOfMonth = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);

  const range = { from, to };

  const { data: fin = [] } = useQuery({
    queryKey: ["rep_fin", companyId, range],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_transactions")
        .select("type,amount,category,occurred_on")
        .eq("company_id", companyId).gte("occurred_on", from).lte("occurred_on", to);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: appts = [] } = useQuery({
    queryKey: ["rep_appts", companyId, range],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments")
        .select("id,status,starts_at,total_cents,staff_id,customer_id")
        .eq("company_id", companyId)
        .gte("starts_at", `${from}T00:00:00`)
        .lte("starts_at", `${to}T23:59:59`);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["rep_products", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("products")
        .select("id,name,stock_qty,min_stock,unit,sale_price")
        .eq("company_id", companyId).eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const income = fin.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const expense = fin.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const done = appts.filter((a: any) => a.status === "completed");
    const cancelled = appts.filter((a: any) => a.status === "cancelled" || a.status === "no_show");
    const ticket = done.length ? done.reduce((s: number, a: any) => s + (a.total_cents ?? 0), 0) / 100 / done.length : 0;
    const uniqueCustomers = new Set(appts.map((a: any) => a.customer_id).filter(Boolean)).size;
    return {
      income, expense, balance: income - expense,
      apptTotal: appts.length, done: done.length, cancelled: cancelled.length,
      ticket, uniqueCustomers,
    };
  }, [fin, appts]);

  const byCategory = useMemo(() => {
    const map: Record<string, { in: number; out: number }> = {};
    for (const t of fin as any[]) {
      const k = t.category || "—";
      if (!map[k]) map[k] = { in: 0, out: 0 };
      if (t.type === "income") map[k].in += Number(t.amount);
      else map[k].out += Number(t.amount);
    }
    return Object.entries(map).sort((a, b) => (b[1].in + b[1].out) - (a[1].in + a[1].out));
  }, [fin]);

  const lowStock = products.filter((p: any) => Number(p.stock_qty) <= Number(p.min_stock));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Desempenho do seu negócio.</p>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div><Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const rows: (string | number)[][] = [
                ["Relatório", `${from} a ${to}`],
                [],
                ["Resumo"],
                ["Faturamento", totals.income],
                ["Despesas", totals.expense],
                ["Saldo", totals.balance],
                ["Ticket médio", totals.ticket],
                ["Agendamentos", totals.apptTotal],
                ["Concluídos", totals.done],
                ["Cancelados/faltas", totals.cancelled],
                ["Clientes atendidos", totals.uniqueCustomers],
                [],
                ["Financeiro por categoria"],
                ["Categoria", "Entradas", "Saídas"],
                ...byCategory.map(([cat, v]) => [cat, v.in, v.out]),
                [],
                ["Estoque baixo"],
                ["Produto", "Estoque", "Mínimo", "Unidade"],
                ...lowStock.map((p: any) => [p.name, Number(p.stock_qty), Number(p.min_stock), p.unit ?? ""]),
              ];
              downloadCsv(`relatorio_${from}_a_${to}.csv`, rows);
            }}
          >
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir / PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Faturamento" value={brl(totals.income)} icon={<DollarSign className="h-5 w-5" />} />
        <Kpi label="Despesas" value={brl(totals.expense)} icon={<DollarSign className="h-5 w-5" />} tone="text-rose-600" />
        <Kpi label="Saldo" value={brl(totals.balance)} icon={<DollarSign className="h-5 w-5" />}
          tone={totals.balance >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <Kpi label="Ticket médio" value={brl(totals.ticket)} icon={<DollarSign className="h-5 w-5" />} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Agendamentos" value={totals.apptTotal.toString()} icon={<CalendarDays className="h-5 w-5" />} />
        <Kpi label="Concluídos" value={totals.done.toString()} icon={<CalendarDays className="h-5 w-5" />} tone="text-emerald-600" />
        <Kpi label="Cancelados/faltas" value={totals.cancelled.toString()} icon={<CalendarDays className="h-5 w-5" />} tone="text-amber-600" />
        <Kpi label="Clientes atendidos" value={totals.uniqueCustomers.toString()} icon={<Users className="h-5 w-5" />} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Financeiro por categoria</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!byCategory.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Sem lançamentos no período.</div>
            ) : (
              <div className="divide-y">
                {byCategory.map(([cat, v]) => (
                  <div key={cat} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium">{cat}</span>
                    <div className="flex gap-4 text-sm">
                      {v.in > 0 && <span className="text-emerald-600">+{brl(v.in)}</span>}
                      {v.out > 0 && <span className="text-rose-600">-{brl(v.out)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" /> Estoque baixo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!lowStock.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Todos os produtos com estoque OK.</div>
            ) : (
              <div className="divide-y">
                {lowStock.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium truncate">{p.name}</span>
                    <span className="text-sm text-amber-600">
                      {Number(p.stock_qty)} / {Number(p.min_stock)} {p.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, tone = "text-foreground" }: {
  label: string; value: string; icon: React.ReactNode; tone?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className={tone}>{icon}</span>
        </div>
        <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
