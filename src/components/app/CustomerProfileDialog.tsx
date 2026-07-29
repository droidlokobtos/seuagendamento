import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { brl, dateBR } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SmartProfilePanel } from "@/components/app/SmartProfile";
import { useSmartHistory, useSmartStats, COMMUNICATION_PREFS, NOTE_KINDS } from "@/lib/smart-profile";
import { Phone, Mail, MessageCircle } from "lucide-react";

type Customer = {
  id: string; name: string; phone: string | null; whatsapp: string | null; email: string | null;
  birthdate: string | null; notes: string | null; photo_url: string | null; source: string | null; created_at: string;
};

export function CustomerProfileDialog({
  customer, companyId, initialTab = "dados",
}: { customer: Customer; companyId: string; initialTab?: string }) {
  const { data: statsData, isLoading } = useSmartStats(customer.id);
  const appts = statsData?.appointments ?? [];
  const { data: history = [] } = useSmartHistory(customer.id);

  const { data: payments = [] } = useQuery({
    enabled: !!appts.length,
    queryKey: ["customer-payments", customer.id, appts.length],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointment_payments")
        .select("id,kind,amount_cents,status,method,created_at,appointment_id")
        .in("appointment_id", appts.map((a: any) => a.id))
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const totalPaid = (payments as any[])
    .filter((p) => p.status === "approved")
    .reduce((s, p) => s + (p.kind === "refund" ? -p.amount_cents : p.amount_cents), 0);

  return (
    <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            {customer.photo_url && <AvatarImage src={customer.photo_url} alt="" />}
            <AvatarFallback>{customer.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          {customer.name}
        </DialogTitle>
      </DialogHeader>

      <Tabs defaultValue={initialTab}>
        <TabsList className="flex w-full flex-wrap h-auto">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="avaliacoes">Avaliações</TabsTrigger>
          <TabsTrigger value="timeline">Linha do Tempo</TabsTrigger>
          <TabsTrigger value="smart">Perfil Inteligente</TabsTrigger>
        </TabsList>


        <TabsContent value="dados" className="mt-4 space-y-3">
          <Card><CardContent className="p-4 space-y-2 text-sm">
            {customer.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{customer.phone}</p>}
            {customer.whatsapp && <p className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-muted-foreground" />{customer.whatsapp}</p>}
            {customer.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{customer.email}</p>}
            {customer.birthdate && <p>🎂 {dateBR(customer.birthdate)}</p>}
            <p className="text-xs text-muted-foreground">Cadastrado em {dateBR(customer.created_at)}</p>
            {customer.notes && <p className="rounded-md bg-muted/40 p-3 text-xs italic">"{customer.notes}"</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="agendamentos" className="mt-4 space-y-2">
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && !appts.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum agendamento ainda.</p>}
          {appts.map((a: any) => {
            const svc = (a.appointment_services ?? []).map((x: any) => x.services?.name).filter(Boolean).join(", ");
            return (
              <div key={a.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">{dateBR(a.starts_at)}</p>
                  <p className="text-xs text-muted-foreground">{svc || "—"}{a.staff?.name ? ` • ${a.staff.name}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{brl(((a.total_cents ?? 0) - (a.discount_cents ?? 0)) / 100)}</p>
                  <p className="text-xs text-muted-foreground capitalize">{a.status}</p>
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="financeiro" className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Total gasto" value={brl((statsData?.stats.totalSpentCents ?? 0) / 100)} />
            <MiniStat label="Ticket médio" value={brl((statsData?.stats.avgTicketCents ?? 0) / 100)} />
            <MiniStat label="Pagamentos aprovados" value={brl(totalPaid / 100)} />
            <MiniStat label="Visitas" value={String(statsData?.stats.totalVisits ?? 0)} />
          </div>
          {(payments as any[]).map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <p className="font-medium capitalize">{p.kind}</p>
                <p className="text-xs text-muted-foreground">{dateBR(p.created_at)} · {p.method ?? "—"}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{brl(p.amount_cents / 100)}</p>
                <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
              </div>
            </div>
          ))}
          {!payments.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum pagamento registrado.</p>}
        </TabsContent>

        <TabsContent value="timeline" className="mt-4 space-y-2">
          {!history.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma alteração registrada.</p>}
          {(history as any[]).map((h) => (
            <div key={h.id} className="rounded-md border p-3 text-sm">
              <p className="font-medium">
                {h.entity === "note" ? "Observação" : h.entity === "date" ? "Data importante" : "Perfil"} ·{" "}
                {h.action === "created" ? "criada" : h.action === "updated" ? "alterada" : "removida"}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(h.created_at).toLocaleString("pt-BR")}
                {h.field ? ` · ${NOTE_KINDS[h.field] ?? COMMUNICATION_PREFS[h.field] ?? h.field}` : ""}
              </p>
              {h.old_value && <p className="mt-1 text-xs text-muted-foreground line-through">{h.old_value}</p>}
              {h.new_value && <p className="text-xs">{h.new_value}</p>}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="smart" className="mt-4">
          <SmartProfilePanel companyId={companyId} customerId={customer.id} />
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
