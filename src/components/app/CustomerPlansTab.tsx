import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { brl, dateBR } from "@/lib/format";
import { PLAN_KINDS, PLAN_STATUS, isExpiredPlan, useCustomerPlansOf, type PlanKind } from "@/lib/plans";

/** Aba "Planos e Pacotes" na ficha do cliente. */
export function CustomerPlansTab({ customerId }: { customerId: string }) {
  const { data: plans = [], isLoading } = useCustomerPlansOf(customerId);
  const ids = plans.map((p: any) => p.id);

  const { data: usage = [] } = useQuery({
    enabled: ids.length > 0,
    queryKey: ["customer-plan-usage", customerId, ids.length],
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_session_usage")
        .select("*")
        .in("customer_plan_id", ids)
        .order("used_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!plans.length) {
    return <p className="text-sm text-muted-foreground">Este cliente não possui planos ou pacotes.</p>;
  }

  return (
    <div className="space-y-3">
      {plans.map((p: any) => {
        const expired = isExpiredPlan(p);
        const st = p.status === "cancelled" ? "cancelled" : expired ? "expired" : "active";
        const balances = p.customer_plan_services ?? [];
        const total = balances.reduce((t: number, b: any) => t + b.sessions_total, 0);
        const used = balances.reduce((t: number, b: any) => t + b.sessions_used, 0);
        return (
          <Card key={p.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.plan_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {PLAN_KINDS[p.kind as PlanKind]} · {brl((p.amount_cents ?? 0) / 100)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Compra {dateBR(p.sold_at)} · Validade {p.expires_at ? dateBR(p.expires_at) : "sem validade"}
                  </p>
                </div>
                <Badge variant="outline" className={PLAN_STATUS[st as keyof typeof PLAN_STATUS].className}>
                  {PLAN_STATUS[st as keyof typeof PLAN_STATUS].label}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={total ? (used / total) * 100 : 0} className="h-1.5 flex-1" />
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{used}/{total} sessões</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {balances.map((b: any) => (
                  <div key={b.id} className="rounded-lg border p-2">
                    <p className="text-sm font-medium">{b.service_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Contratadas: {b.sessions_total} · Utilizadas: {b.sessions_used} · Disponíveis:{" "}
                      {Math.max(0, b.sessions_total - b.sessions_used)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div>
        <p className="text-xs font-medium mb-1">Histórico completo de utilização</p>
        {usage.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma sessão utilizada ainda.</p>
        ) : (
          <ul className="space-y-1">
            {(usage as any[]).map((u) => (
              <li key={u.id} className="text-xs text-muted-foreground">
                {new Date(u.used_at).toLocaleString("pt-BR")} · {u.service_name}
                {u.staff_name ? ` · ${u.staff_name}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
