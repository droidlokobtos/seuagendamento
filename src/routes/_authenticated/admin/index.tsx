import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CheckCircle2, AlertTriangle, Clock, DollarSign } from "lucide-react";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

const MONTHLY_FEE = 49.9;

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneMap = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  } as const;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`grid h-12 w-12 place-items-center rounded-xl ${toneMap[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold truncate">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const [{ data: companies }, { data: payments }] = await Promise.all([
        supabase.from("companies").select("id, name, status, created_at, next_due_at, monthly_fee"),
        supabase.from("payments").select("amount, paid_at, created_at").order("paid_at", { ascending: false }).limit(500),
      ]);
      return { companies: companies ?? [], payments: payments ?? [] };
    },
  });

  const companies = data?.companies ?? [];
  const payments = data?.payments ?? [];
  const active = companies.filter((c: any) => c.status === "active").length;
  const dueSoon = companies.filter((c: any) => c.status === "due_soon").length;
  const overdue = companies.filter((c: any) => c.status === "overdue" || c.status === "suspended").length;
  const mrr = companies.filter((c: any) => c.status === "active").reduce((s: number, c: any) => s + Number(c.monthly_fee || 0), 0);
  const now = new Date();
  const paidThisMonth = payments
    .filter((p: any) => p.paid_at && new Date(p.paid_at).getMonth() === now.getMonth() && new Date(p.paid_at).getFullYear() === now.getFullYear())
    .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Visão geral</h2>
        <p className="text-sm text-muted-foreground mt-1">Resumo das empresas e pagamentos da plataforma.</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Empresas" value={isLoading ? "…" : companies.length} hint={`${active} ativas`} />
        <StatCard icon={CheckCircle2} label="Ativas" value={isLoading ? "…" : active} tone="success" />
        <StatCard icon={Clock} label="Próx. venc." value={isLoading ? "…" : dueSoon} tone="warning" />
        <StatCard icon={AlertTriangle} label="Em atraso" value={isLoading ? "…" : overdue} tone="danger" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Receita recorrente estimada</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{brl(mrr)}</p>
            <p className="text-xs text-muted-foreground mt-1">{active} empresas × {brl(MONTHLY_FEE)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Recebido no mês</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-emerald-500" />
              <p className="text-3xl font-bold">{brl(paidThisMonth)}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pagamentos confirmados neste mês</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimos pagamentos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {payments.slice(0, 8).map((p: any, i: number) => (
                <li key={i} className="flex items-center justify-between px-6 py-3 text-sm">
                  <div>
                    <p className="font-medium">{brl(Number(p.amount))}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <span className={`text-xs font-medium rounded-full px-2 py-0.5 border ${
                    p.status === "paid" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                    p.status === "pending" ? "bg-amber-100 text-amber-700 border-amber-200" :
                    "bg-red-100 text-red-700 border-red-200"
                  }`}>{p.status}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
