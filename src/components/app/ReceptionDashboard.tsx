import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { usePermissions } from "@/lib/use-permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Cake, UserPlus, CheckCircle2, LogIn, LogOut, Wallet } from "lucide-react";

export function ReceptionDashboard() {
  const { activeCompany } = useCompany();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const companyId = activeCompany?.id;

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const mmdd = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const { data, isLoading } = useQuery({
    queryKey: ["reception-dashboard", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [todayR, birthdaysR] = await Promise.all([
        supabase
          .from("appointments")
          .select("id,starts_at,status,notes,customers(id,name,phone),staff(name),appointment_services(services(name))")
          .eq("company_id", companyId!)
          .gte("starts_at", start)
          .lt("starts_at", end)
          .order("starts_at"),
        supabase
          .from("customers")
          .select("id,name,birth_date,phone")
          .eq("company_id", companyId!)
          .not("birth_date", "is", null)
          .limit(400),
      ]);
      const birthdays = (birthdaysR.data ?? []).filter(
        (c: any) => (c.birth_date ?? "").slice(5, 10) === mmdd,
      );
      return { today: todayR.data ?? [], birthdays };
    },
  });

  const setStatus = useMutation({
    mutationFn: async (v: { id: string; status: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: v.status as any })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atendimento atualizado");
      qc.invalidateQueries({ queryKey: ["reception-dashboard", companyId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const list = (data?.today ?? []) as any[];
  const waiting = list.filter((a) => a.status === "confirmed" || a.status === "scheduled");
  const inProgress = list.filter((a) => a.status === "in_progress");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Painel da recepção</h1>
          <p className="text-sm text-muted-foreground">
            Agenda do dia, check-in/check-out e cadastro de clientes.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {can("agendamentos") && (
            <Button asChild size="sm">
              <Link to="/app/agenda">
                <Calendar className="h-4 w-4 mr-1.5" /> Novo agendamento
              </Link>
            </Button>
          )}
          {can("clientes_cadastro") && (
            <Button asChild size="sm" variant="outline">
              <Link to="/app/customers">
                <UserPlus className="h-4 w-4 mr-1.5" /> Novo cliente
              </Link>
            </Button>
          )}
          {can("caixa") && (
            <Button asChild size="sm" variant="outline">
              <Link to="/app/sales">
                <Wallet className="h-4 w-4 mr-1.5" /> Caixa
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Mini label="Agendamentos hoje" value={String(list.length)} />
        <Mini label="Aguardando" value={String(waiting.length)} />
        <Mini label="Em atendimento" value={String(inProgress.length)} />
        <Mini label="Aniversariantes" value={String((data?.birthdays ?? []).length)} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Agenda do dia
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
          ) : list.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum agendamento hoje.</p>
          ) : (
            <div className="divide-y">
              {list.map((a) => (
                <div key={a.id} className="p-4 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {new Date(a.starts_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {a.customers?.name ?? "Cliente"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {(a.appointment_services ?? [])
                        .map((s: any) => s.services?.name)
                        .filter(Boolean)
                        .join(", ") || "Serviço"}
                      {a.staff?.name ? ` · ${a.staff.name}` : ""}
                      {can("ver_contato_cliente") && a.customers?.phone ? ` · ${a.customers.phone}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">{a.status}</Badge>
                  {can("agendamentos") && (
                    <div className="flex gap-1.5">
                      {a.status !== "in_progress" && a.status !== "completed" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatus.mutate({ id: a.id, status: "confirmed" })}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirmar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setStatus.mutate({ id: a.id, status: "in_progress" })}
                          >
                            <LogIn className="h-3.5 w-3.5 mr-1" /> Check-in
                          </Button>
                        </>
                      )}
                      {a.status === "in_progress" && (
                        <Button
                          size="sm"
                          onClick={() => setStatus.mutate({ id: a.id, status: "completed" })}
                        >
                          <LogOut className="h-3.5 w-3.5 mr-1" /> Check-out
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Cake className="h-4 w-4" /> Aniversariantes de hoje
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(data?.birthdays ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum aniversariante hoje.</p>
          ) : (
            <div className="divide-y">
              {(data!.birthdays as any[]).map((c) => (
                <div key={c.id} className="p-3 text-sm flex justify-between gap-2">
                  <span>{c.name}</span>
                  {can("ver_contato_cliente") && (
                    <span className="text-xs text-muted-foreground">{c.phone}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
