import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, Gift, Hourglass, Link2, Percent, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/referrals")({ component: Referrals });

const statusMeta: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  pending: { label: "Aguardando pagamento", variant: "outline" },
  qualified: { label: "Desconto disponível", variant: "default" },
  applied: { label: "Desconto aplicado", variant: "secondary" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

function Referrals() {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id;
  const { data, isLoading } = useQuery({
    queryKey: ["company-referrals", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_company_referral_dashboard", {
        _company_id: companyId,
      });
      if (error) throw error;
      return data as any;
    },
  });
  const code = String(data?.code ?? "");
  const link =
    typeof window === "undefined" || !code ? "" : `${window.location.origin}/auth?ref=${code}`;
  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">
          Crescimento
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Indique e ganhe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Indique novas empresas e receba desconto nas próximas cobranças quando elas pagarem o
          primeiro plano.
        </p>
      </div>

      <Card className="overflow-hidden border-primary/20 bg-primary/[.03]">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <p className="font-semibold">Seu link exclusivo de indicação</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Envie este link para outra empresa. O código será reconhecido no cadastro.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <div className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3 font-mono text-sm break-all">
                {isLoading ? "Carregando…" : link}
              </div>
              <Button disabled={!link} onClick={() => copy(link, "Link")}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar link
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border bg-background p-5 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Seu código</p>
            <p className="mt-2 font-mono text-2xl font-bold tracking-[.2em]">{code || "—"}</p>
            <Button
              className="mt-3"
              size="sm"
              variant="ghost"
              disabled={!code}
              onClick={() => copy(code, "Código")}
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copiar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Users} label="Indicações" value={data?.summary?.total ?? 0} />
        <Stat icon={Hourglass} label="Aguardando pagamento" value={data?.summary?.pending ?? 0} />
        <Stat icon={Percent} label="Descontos disponíveis" value={data?.summary?.available ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como funciona</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Rule title="Plano Básico" value="2%" />
          <Rule title="Plano Business" value="5%" />
          <Rule title="Plano Pro" value="10%" />
          <p className="md:col-span-3 text-xs text-muted-foreground">
            Somente um desconto é aplicado por cobrança. Se houver várias recompensas, elas serão
            usadas automaticamente nos meses seguintes, por ordem de liberação.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de indicações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 pl-6 text-left">Empresa indicada</th>
                  <th className="p-3 text-left">Plano</th>
                  <th className="p-3 text-left">Recompensa</th>
                  <th className="p-3 text-left">Data</th>
                  <th className="p-3 pr-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.referrals ?? []).map((r: any) => {
                  const meta = statusMeta[r.status] ?? statusMeta.pending;
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="p-3 pl-6 font-medium">{r.company_name}</td>
                      <td className="p-3 capitalize">{r.plan_code ?? "—"}</td>
                      <td className="p-3 font-semibold">
                        {r.reward_percent ? `${r.reward_percent}%` : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">{dateBR(r.created_at)}</td>
                      <td className="p-3 pr-6 text-right">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && !data?.referrals?.length && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-muted-foreground">
                      <Link2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      Nenhuma indicação registrada.
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

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
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
function Rule({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-primary">{value}</p>
      <p className="text-xs text-muted-foreground">na próxima cobrança</p>
    </div>
  );
}
