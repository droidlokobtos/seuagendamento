import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateBR } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Clock, Wallet } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/_authenticated/reseller/")({
  validateSearch: z.object({ reseller: z.string().uuid().optional() }),
  component: Dashboard,
});
function Dashboard() {
  const { isSuperAdmin, user } = useAuth();
  const { reseller: selectedReseller } = Route.useSearch();
  const { data, isLoading } = useQuery({
    queryKey: ["reseller-dashboard", isSuperAdmin, selectedReseller, user?.id],
    enabled: !isSuperAdmin || !!selectedReseller,
    queryFn: async () => {
      let profileQuery = (supabase.from as any)("resellers").select("*");
      profileQuery = isSuperAdmin
        ? profileQuery.eq("id", selectedReseller)
        : profileQuery.eq("user_id", user?.id);
      const { data: r, error } = await profileQuery.single();
      if (error) throw error;
      const { data: s } = await (supabase.from as any)("reseller_sales")
        .select("*,companies(name,plan_code)")
        .eq("reseller_id", r.id)
        .order("created_at", { ascending: false });
      return { profile: r, sales: s ?? [] };
    },
  });
  if (isSuperAdmin && !selectedReseller)
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="p-8 text-center">
          <ShieldMessage />
          <h1 className="mt-4 text-lg font-semibold">Selecione um revendedor</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Abra este painel pela área de revendedores do Admin Master.
          </p>
          <Button className="mt-5" asChild>
            <a href="/admin/resellers">Voltar aos revendedores</a>
          </Button>
        </CardContent>
      </Card>
    );
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
        {isSuperAdmin && (
          <Badge variant="outline" className="mt-3">
            Visualização do Admin Master
          </Badge>
        )}
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
function ShieldMessage() {
  return (
    <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
      <Wallet className="h-6 w-6" />
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
