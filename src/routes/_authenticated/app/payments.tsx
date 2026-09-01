import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import {
  computeFinance, PAYMENT_STATUS_META, PAYMENT_KIND_LABEL, AUDIT_ACTION_LABEL,
  type AppointmentPaymentStatus,
} from "@/lib/finance";
import { Check, X, FileText, History, Plus, Wallet, Clock, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/payments")({
  component: PaymentsPage,
  head: () => ({
    meta: [
      { title: "Pagamentos e sinais · Gestão financeira" },
      { name: "description", content: "Aprove comprovantes de sinal, registre pagamentos e acompanhe a auditoria financeira dos atendimentos." },
      { property: "og:title", content: "Pagamentos e sinais" },
      { property: "og:description", content: "Central financeira dos atendimentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Appt = {
  id: string; starts_at: string; status: string;
  total_cents: number; discount_cents: number; surcharge_cents: number;
  paid_cents: number; deposit_required_cents: number; payment_status: AppointmentPaymentStatus;
  customers: { name: string } | null; staff: { name: string } | null;
  default_payment_kind?: "deposit" | "final" | "extra" | "refund";
};

type Pay = {
  id: string; appointment_id: string; kind: "deposit" | "final" | "extra" | "refund";
  amount_cents: number; status: "pending" | "approved" | "rejected";
  proof_url: string | null; transaction_ref: string | null; method: string | null;
  reject_reason: string | null; created_at: string;
};

function PaymentsPage() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;

  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [filter, setFilter] = useState<"all" | "awaiting_approval" | "open" | "paid">("all");
  const [payFor, setPayFor] = useState<Appt | null>(null);
  const [auditFor, setAuditFor] = useState<Appt | null>(null);

  const { data: appts = [], isLoading } = useQuery({
    queryKey: ["fin_appts", companyId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id,starts_at,status,total_cents,discount_cents,surcharge_cents,paid_cents,deposit_required_cents,payment_status,customers(name),staff(name)")
        .eq("company_id", companyId)
        .gte("starts_at", `${from}T00:00:00`)
        .lte("starts_at", `${to}T23:59:59`)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Appt[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["fin_payments", companyId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_payments")
        .select("*").eq("company_id", companyId)
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Pay[];
    },
  });

  const byAppt = useMemo(() => {
    const m: Record<string, Pay[]> = {};
    for (const p of payments) (m[p.appointment_id] ??= []).push(p);
    return m;
  }, [payments]);

  const review = useMutation({
    mutationFn: async (v: { id: string; status: "approved" | "rejected"; reason?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("appointment_payments").update({
        status: v.status,
        reject_reason: v.reason ?? null,
        reviewed_by: u.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      } as any).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "approved" ? "Pagamento aprovado · reserva confirmada" : "Comprovante rejeitado");
      qc.invalidateQueries({ queryKey: ["fin_payments", companyId] });
      qc.invalidateQueries({ queryKey: ["fin_appts", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addPayment = useMutation({
    mutationFn: async (v: { appointment_id: string; kind: Pay["kind"]; amount_cents: number; method: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("appointment_payments").insert({
        company_id: companyId,
        appointment_id: v.appointment_id,
        kind: v.kind,
        amount_cents: v.amount_cents,
        method: v.method,
        status: "approved",
        created_by: u.user?.id ?? null,
        reviewed_by: u.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.kind === "deposit" ? "Sinal antecipado registrado" : "Pagamento registrado no caixa");
      setPayFor(null);
      qc.invalidateQueries({ queryKey: ["fin_payments", companyId] });
      qc.invalidateQueries({ queryKey: ["fin_appts", companyId] });
      qc.invalidateQueries({ queryKey: ["finances", companyId] });
      qc.invalidateQueries({ queryKey: ["appts", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openProof = async (path: string) => {
    if (/^https?:\/\//.test(path)) { window.open(path, "_blank"); return; }
    const { data, error } = await supabase.storage.from("company-assets").createSignedUrl(path, 600);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir o comprovante"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const rows = useMemo(() => {
    return appts.filter((a) => {
      const f = computeFinance({
        subtotalCents: a.total_cents, discountCents: a.discount_cents,
        surchargeCents: a.surcharge_cents, paidCents: a.paid_cents,
        depositRequiredCents: a.deposit_required_cents,
      });
      if (filter === "awaiting_approval") return (byAppt[a.id] ?? []).some((p) => p.status === "pending");
      if (filter === "open") return f.balanceCents > 0 && a.status !== "cancelled";
      if (filter === "paid") return f.fullyPaid;
      return true;
    });
  }, [appts, filter, byAppt]);

  const totals = useMemo(() => {
    let received = 0, pending = 0, deposits = 0, awaiting = 0;
    for (const a of appts) {
      const f = computeFinance({
        subtotalCents: a.total_cents, discountCents: a.discount_cents,
        surchargeCents: a.surcharge_cents, paidCents: a.paid_cents,
        depositRequiredCents: a.deposit_required_cents,
      });
      received += Math.max(0, a.paid_cents);
      if (a.status !== "cancelled") pending += f.balanceCents;
      for (const p of byAppt[a.id] ?? []) {
        if (p.kind === "deposit" && p.status === "approved") deposits += p.amount_cents;
        if (p.status === "pending") awaiting += p.amount_cents;
      }
    }
    return { received, pending, deposits, awaiting };
  }, [appts, byAppt]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Pagamentos</h1>
          <p className="text-sm text-muted-foreground">
            Sinais, saldos e caixa de cada atendimento — sempre com a mesma base de cálculo.
          </p>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div><Label className="text-xs">De</Label>
            <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Até</Label>
            <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="awaiting_approval">Aguardando aprovação</SelectItem>
              <SelectItem value="open">Com saldo em aberto</SelectItem>
              <SelectItem value="paid">Pagos integralmente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Recebido" value={totals.received} icon={<Wallet className="h-5 w-5" />} tone="text-emerald-600" />
        <Kpi label="Sinais confirmados" value={totals.deposits} icon={<Check className="h-5 w-5" />} tone="text-sky-600" />
        <Kpi label="Aguardando aprovação" value={totals.awaiting} icon={<Clock className="h-5 w-5" />} tone="text-amber-600" />
        <Kpi label="Saldo pendente" value={totals.pending} icon={<RotateCcw className="h-5 w-5" />} tone="text-rose-600" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Carregando…</div>
          ) : !rows.length ? (
            <div className="p-12 text-center text-muted-foreground">Nenhum atendimento no período.</div>
          ) : (
            <div className="divide-y">
              {rows.map((a) => {
                const f = computeFinance({
                  subtotalCents: a.total_cents, discountCents: a.discount_cents,
                  surchargeCents: a.surcharge_cents, paidCents: a.paid_cents,
                  depositRequiredCents: a.deposit_required_cents,
                });
                const meta = PAYMENT_STATUS_META[a.payment_status] ?? PAYMENT_STATUS_META.pending;
                const list = byAppt[a.id] ?? [];
                return (
                  <div key={a.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{a.customers?.name ?? "Cliente"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.starts_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          {a.staff?.name ? ` · ${a.staff.name}` : ""}
                        </p>
                      </div>
                      <Badge className={meta.className} variant="secondary">{meta.label}</Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <Cell label="Total" value={brl(f.totalCents / 100)} />
                      <Cell label="Sinal exigido" value={brl(f.depositRequiredCents / 100)} />
                      <Cell label="Pago" value={brl(f.paidCents / 100)} tone="text-emerald-600" />
                      <Cell label="Saldo" value={brl(f.balanceCents / 100)} tone={f.balanceCents ? "text-rose-600" : "text-muted-foreground"} />
                    </div>

                    {list.length > 0 && (
                      <div className="rounded-lg border divide-y">
                        {list.map((p) => (
                          <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm flex-wrap">
                            <div className="min-w-0">
                              <p className="font-medium">
                                {PAYMENT_KIND_LABEL[p.kind]} · {brl(p.amount_cents / 100)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(p.created_at).toLocaleString("pt-BR")}
                                {p.transaction_ref ? ` · ID ${p.transaction_ref}` : ""}
                                {p.method ? ` · ${p.method}` : ""}
                                {p.status === "rejected" ? " · rejeitado" : p.status === "approved" ? " · aprovado" : " · aguardando"}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {p.proof_url && (
                                <Button size="sm" variant="outline" onClick={() => openProof(p.proof_url!)}>
                                  <FileText className="h-4 w-4 mr-1" /> Comprovante
                                </Button>
                              )}
                              {p.status === "pending" && (
                                <>
                                  <Button size="sm" onClick={() => review.mutate({ id: p.id, status: "approved" })}>
                                    <Check className="h-4 w-4 mr-1" /> Aprovar
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => {
                                    const reason = prompt("Motivo da rejeição (o cliente poderá reenviar):") ?? "";
                                    review.mutate({ id: p.id, status: "rejected", reason });
                                  }}>
                                    <X className="h-4 w-4 mr-1" /> Rejeitar
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      {f.depositDueCents > 0 && f.balanceCents > 0 && (
                        <Button
                          size="sm"
                          onClick={() => setPayFor({ ...a, default_payment_kind: "deposit" })}
                        >
                          <Wallet className="h-4 w-4 mr-1" /> Registrar sinal antecipado
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={f.balanceCents <= 0}
                        onClick={() => setPayFor({ ...a, default_payment_kind: "final" })}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Registrar pagamento
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAuditFor(a)}>
                        <History className="h-4 w-4 mr-1" /> Histórico
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {payFor && (
        <PaymentDialog
          appt={payFor}
          onClose={() => setPayFor(null)}
          loading={addPayment.isPending}
          onSave={(v) => addPayment.mutate({ appointment_id: payFor.id, ...v })}
        />
      )}
      {auditFor && <AuditDialog appt={auditFor} onClose={() => setAuditFor(null)} />}
    </div>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className={tone}>{icon}</span>
        </div>
        <p className={`mt-2 text-2xl font-semibold ${tone}`}>{brl(value / 100)}</p>
      </CardContent>
    </Card>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function PaymentDialog({ appt, onClose, onSave, loading }: {
  appt: Appt;
  onClose: () => void;
  onSave: (v: { kind: "deposit" | "final" | "extra" | "refund"; amount_cents: number; method: string }) => void;
  loading: boolean;
}) {
  const f = computeFinance({
    subtotalCents: appt.total_cents, discountCents: appt.discount_cents,
    surchargeCents: appt.surcharge_cents, paidCents: appt.paid_cents,
    depositRequiredCents: appt.deposit_required_cents,
  });
  const defaultKind = appt.default_payment_kind ?? "final";
  const initialCents = defaultKind === "deposit" && f.depositDueCents > 0 ? f.depositDueCents : f.balanceCents;
  const [kind, setKind] = useState<"deposit" | "final" | "extra" | "refund">(defaultKind);
  const [amount, setAmount] = useState((initialCents / 100).toFixed(2));
  const [method, setMethod] = useState("pix");

  const changeKind = (v: "deposit" | "final" | "extra" | "refund") => {
    setKind(v);
    if (v === "deposit") {
      const suggested = f.depositDueCents > 0 ? f.depositDueCents : Math.min(f.depositRequiredCents || f.balanceCents, f.balanceCents);
      if (suggested > 0) setAmount((suggested / 100).toFixed(2));
    } else if (v === "final") {
      setAmount((f.balanceCents / 100).toFixed(2));
    }
  };

  const parsedCents = Math.round((parseFloat(amount) || 0) * 100);
  const exceedsBalance = kind !== "refund" && kind !== "extra" && parsedCents > f.balanceCents;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kind === "deposit" ? "Registrar sinal antecipado" : "Registrar pagamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Total</span><span>{brl(f.totalCents / 100)}</span></div>
            <div className="flex justify-between"><span>Sinal exigido</span><span>{brl(f.depositRequiredCents / 100)}</span></div>
            <div className="flex justify-between"><span>Já pago</span><span>{brl(f.paidCents / 100)}</span></div>
            <div className="flex justify-between font-semibold"><span>Saldo restante</span><span>{brl(f.balanceCents / 100)}</span></div>
          </div>
          {kind === "deposit" && f.depositDueCents > 0 && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs">
              Valor sugerido do sinal ainda pendente: <strong>{brl(f.depositDueCents / 100)}</strong>. A administradora pode alterar o valor abaixo.
            </p>
          )}
          <div>
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => changeKind(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="deposit">Sinal (antecipado)</SelectItem>
                <SelectItem value="final">Pagamento final</SelectItem>
                <SelectItem value="extra">Acréscimo</SelectItem>
                <SelectItem value="refund">Estorno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            {exceedsBalance && <p className="mt-1 text-xs text-destructive">O valor não pode ser maior que o saldo restante.</p>}
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="credit_card">Cartão de crédito</SelectItem>
                <SelectItem value="debit_card">Cartão de débito</SelectItem>
                <SelectItem value="bank_transfer">Transferência</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            O valor registrado será somado ao total já pago e o saldo restante será recalculado automaticamente para o fechamento do atendimento.
          </p>
        </div>
        <DialogFooter>
          <Button
            disabled={loading || parsedCents <= 0 || exceedsBalance}
            onClick={() => onSave({ kind, amount_cents: parsedCents, method })}
          >
            {loading ? "Registrando..." : kind === "deposit" ? "Registrar sinal" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuditDialog({ appt, onClose }: { appt: Appt; onClose: () => void }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["fin_audit", appt.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_audit_log").select("*")
        .eq("appointment_id", appt.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Histórico financeiro</DialogTitle></DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !data.length ? (
          <p className="text-sm text-muted-foreground">Sem registros.</p>
        ) : (
          <div className="max-h-96 overflow-auto divide-y">
            {(data as any[]).map((l) => (
              <div key={l.id} className="py-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{AUDIT_ACTION_LABEL[l.action] ?? l.action}</span>
                  {!!l.amount_cents && <span>{brl(l.amount_cents / 100)}</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString("pt-BR")}
                  {l.description ? ` · ${l.description}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
