import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Gift, Hourglass, Percent, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/referrals")({
  component: AdminReferrals,
});

const labels: Record<string, string> = {
  pending: "Aguardando pagamento",
  qualified: "Disponível",
  applied: "Aplicada",
  cancelled: "Cancelada",
};
function AdminReferrals() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-referrals"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_admin_referral_dashboard");
      if (error) throw error;
      return data as any;
    },
  });
  const change = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase.rpc as any)("admin_set_referral_status", {
        _referral_id: id,
        _status: status,
        _reason: status === "cancelled" ? "Cancelada manualmente pelo Admin Master" : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Indicação atualizada");
      qc.invalidateQueries({ queryKey: ["admin-referrals"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const summary = data?.summary ?? {};
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Programa de indicações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe indicações, recompensas liberadas e descontos utilizados.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="Total" value={summary.total} />
        <Stat icon={Hourglass} label="Aguardando" value={summary.pending} />
        <Stat icon={Percent} label="Disponíveis" value={summary.available} />
        <Stat icon={CheckCircle2} label="Aplicadas" value={summary.applied} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todas as indicações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 pl-6 text-left">Quem indicou</th>
                  <th className="p-3 text-left">Empresa indicada</th>
                  <th className="p-3 text-left">Plano</th>
                  <th className="p-3 text-left">Desconto</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Criada em</th>
                  <th className="p-3 pr-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(data?.referrals ?? []).map((r: any) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 pl-6 font-medium">{r.referrer_name}</td>
                    <td className="p-3">{r.referred_name}</td>
                    <td className="p-3 capitalize">{r.plan_code ?? "—"}</td>
                    <td className="p-3 font-semibold">
                      {r.reward_percent ? `${r.reward_percent}%` : "—"}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={
                          r.status === "cancelled"
                            ? "destructive"
                            : r.status === "qualified"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {labels[r.status] ?? r.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{dateBR(r.created_at)}</td>
                    <td className="p-3 pr-6">
                      <div className="flex justify-end gap-2">
                        {r.status !== "applied" && r.status !== "cancelled" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => change.mutate({ id: r.id, status: "cancelled" })}
                          >
                            <Ban className="mr-1 h-3.5 w-3.5" />
                            Cancelar
                          </Button>
                        )}
                        {r.status === "cancelled" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              change.mutate({
                                id: r.id,
                                status: r.reward_percent ? "qualified" : "pending",
                              })
                            }
                          >
                            Restaurar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && !data?.referrals?.length && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-muted-foreground">
                      <Gift className="mx-auto mb-2 h-9 w-9 opacity-40" />
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
          <p className="text-2xl font-semibold">{value ?? 0}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
