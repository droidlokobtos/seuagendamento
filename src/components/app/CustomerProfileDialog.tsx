import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { brl, dateBR } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SmartProfilePanel } from "@/components/app/SmartProfile";
import { CustomerTimeline } from "@/components/app/CustomerTimeline";
import { useSmartHistory, useSmartStats, COMMUNICATION_PREFS, NOTE_KINDS } from "@/lib/smart-profile";
import { Progress } from "@/components/ui/progress";
import {
  ATTENDANCE_EVENTS, CLASSIFICATION, useAttendanceSettings, useCustomerAttendance, summarize,
} from "@/lib/attendance";

import { Phone, Mail, MessageCircle } from "lucide-react";
import { AnamnesisTab, useIsCompanyAdmin } from "@/components/app/AnamnesisTab";



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
  const { data: reviews = [] } = useQuery({
    queryKey: ["customer-reviews", customer.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id,rating,comment,service_names,created_at")
        .eq("customer_id", customer.id)
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
          <TabsTrigger value="comparecimento">Comparecimento</TabsTrigger>
          <TabsTrigger value="timeline">Linha do Tempo</TabsTrigger>
          {canSeeAnamnesis && <TabsTrigger value="anamnese">Anamnese</TabsTrigger>}
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

        <TabsContent value="avaliacoes" className="mt-4 space-y-2">

          {!reviews.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma avaliação ainda.</p>}
          {(reviews as any[]).map((r) => (
            <div key={r.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">{"⭐".repeat(Math.max(1, Math.min(5, r.rating)))}</p>
                <span className="text-xs text-muted-foreground">{dateBR(r.created_at)}</span>
              </div>
              {r.service_names && <p className="text-xs text-muted-foreground">{r.service_names}</p>}
              {r.comment && <p className="mt-1 rounded bg-muted/40 p-2 text-xs italic">"{r.comment}"</p>}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="comparecimento" className="mt-4">
          <AttendanceTab companyId={companyId} customerId={customer.id} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">

          <CustomerTimeline customerId={customer.id} customer={{ name: customer.name, created_at: customer.created_at }} />
        </TabsContent>


        <TabsContent value="anamnese" className="mt-4">
          <AnamnesisTab companyId={companyId} customerId={customer.id} customerName={customer.name} />
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

function AttendanceTab({ companyId, customerId }: { companyId: string; customerId: string }) {
  const { data: settings } = useAttendanceSettings(companyId);
  const { data: events = [], isLoading } = useCustomerAttendance(customerId);
  const s = summarize(events, settings);
  const meta = CLASSIFICATION[s.classification];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Confiabilidade do cliente</p>
            <Badge variant="outline" className={meta.badge}>{meta.emoji} {meta.label}</Badge>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">Pontuação: {s.score}/100</p>
            <Progress value={s.score} className="h-2" />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">Taxa de comparecimento: {s.rate}%</p>
            <Progress value={s.rate} className="h-2" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <MiniStat label="Presenças" value={String(s.completed)} />
            <MiniStat label="Faltas" value={String(s.noShows)} />
            <MiniStat label="Cancel. em cima da hora" value={String(s.lateCancels)} />
            <MiniStat label="Prejuízo gerado" value={brl(s.lostCents / 100)} />
          </div>
        </CardContent>
      </Card>

      {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && !events.length && (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum registro de comparecimento ainda.</p>
      )}

      <div className="space-y-2">
        {events.map((e) => {
          const em = ATTENDANCE_EVENTS[e.event] ?? { label: e.event, emoji: "•", tone: "" };
          return (
            <div key={e.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <p className="font-medium">{em.emoji} {em.label}</p>
                <p className="text-xs text-muted-foreground">
                  {dateBR(e.occurred_at)}
                  {e.hours_before != null && e.event !== "completed"
                    ? ` · ${Math.max(0, Math.round(Number(e.hours_before)))}h de antecedência`
                    : ""}
                </p>
              </div>
              {e.amount_cents > 0 && (
                <Badge variant="secondary" className="text-[10px]">{brl(e.amount_cents / 100)}</Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
