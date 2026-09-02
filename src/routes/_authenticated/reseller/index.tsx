import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateBR } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Clock, Wallet } from "lucide-react";
export const Route = createFileRoute("/_authenticated/reseller/")({ component: Dashboard });
function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["reseller-dashboard"],
    queryFn: async () => {
      const { data: r, error } = await (supabase.from as any)("resellers").select("*").single();
      if (error) throw error;
      const { data: s } = await (supabase.from as any)("reseller_sales")
        .select("*,companies(name,plan_code)")
        .order("created_at", { ascending: false });
      return { profile: r, sales: s ?? [] };
    },
  });
  const sales = data?.sales ?? [];
  const earned = sales
    .filter((s: any) => s.status === "earned")
    .reduce((n: number, s: any) => n + Number(s.commission_amount || 0), 0);
  const paid = sales
    .filter((s: any) => s.status === "paid")
    .reduce((n: number, s: any) => n + Number(s.commission_amount || 0), 0);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
          Área do parceiro
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Olá, {data?.profile?.name ?? "revendedor"}</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe suas vendas, comissões e próximos repasses.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Building2} label="Empresas vendidas" value={isLoading ? "…" : sales.length} />
        <Stat icon={Clock} label="Próximos repasses" value={brl(earned)} />
        <Stat icon={Wallet} label="Total já recebido" value={brl(paid)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Minhas vendas e repasses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-4 text-left">Empresa</th>
                  <th className="p-4 text-left">Taxa</th>
                  <th className="p-4 text-left">Comissão</th>
                  <th className="p-4 text-left">Data do repasse</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s: any) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-4 font-medium">{s.companies?.name}</td>
                    <td className="p-4">{s.commission_percent}%</td>
                    <td className="p-4 font-semibold">
                      {s.commission_amount ? brl(Number(s.commission_amount)) : "—"}
                    </td>
                    <td className="p-4">
                      {s.scheduled_payout_date
                        ? dateBR(s.scheduled_payout_date)
                        : "Após a 1ª mensalidade"}
                    </td>
                    <td className="p-4 text-right">
                      <Badge
                        variant={
                          s.status === "paid"
                            ? "secondary"
                            : s.status === "earned"
                              ? "default"
                              : "outline"
                        }
                      >
                        {s.status === "paid"
                          ? "Pago"
                          : s.status === "earned"
                            ? "Aguardando repasse"
                            : "Aguardando pagamento"}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {!sales.length && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-muted-foreground">
                      Nenhuma venda vinculada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
function Stat({ icon: Icon, label, value }: any) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
