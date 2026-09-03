import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { brl, dateBR, openWhatsAppLink, statusLabel, waLink } from "@/lib/format";
import {
  CreditCard,
  Plus,
  MessageCircle,
  CalendarClock,
  PauseCircle,
  PlayCircle,
  Copy,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { generatePaymentReceipt } from "@/lib/receipt";
import {
  calculatePlanCyclePrice,
  PLAN_CYCLE_OPTIONS,
  type PlanCycleMonths,
} from "@/lib/plan-cycle";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: Payments,
});

type DialogMode = null | "register" | "charge" | "due" | "suspend";

function Payments() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<DialogMode>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [amount, setAmount] = useState("49.90");
  const [note, setNote] = useState("");
  const [newDue, setNewDue] = useState("");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () =>
      (
        await supabase
          .from("payments")
          .select("*, companies(name, slug)")
          .order("paid_at", { ascending: false })
          .limit(200)
      ).data ?? [],
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["admin-companies-billing"],
    queryFn: async () =>
      (
        await supabase
          .from("companies")
          .select(
            "id, name, slug, monthly_fee, next_due_at, status, suspended_at, plan_code, plan_cycle_months",
          )
          .order("name")
      ).data ?? [],
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["subscription-plans", "billing"],
    queryFn: async () =>
      (
        await supabase
          .from("subscription_plans")
          .select("code, monthly_cents, cycle_months, cycle_total_cents, discount_percent")
          .eq("active", true)
      ).data ?? [],
  });

  const { data: settings } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => (await supabase.from("platform_settings").select("*").maybeSingle()).data,
  });

  const { data: referralData } = useQuery({
    queryKey: ["admin-referrals-for-billing"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_admin_referral_dashboard");
      if (error) throw error;
      return data as any;
    },
  });

  const selected = useMemo(
    () => companies.find((c: any) => c.id === selectedId) as any,
    [companies, selectedId],
  );
  const nextReferral = useMemo(
    () =>
      (referralData?.referrals ?? [])
        .filter((r: any) => r.referrer_company_id === selectedId && r.status === "qualified")
        .sort((a: any, b: any) => String(a.qualified_at).localeCompare(String(b.qualified_at)))[0],
    [referralData, selectedId],
  );

  const cycleAmount = (company: any) => {
    const months = PLAN_CYCLE_OPTIONS.includes(company?.plan_cycle_months)
      ? (company.plan_cycle_months as PlanCycleMonths)
      : 1;
    const plan = plans.find((item) => item.code === company?.plan_code);
    return (
      calculatePlanCyclePrice({
        monthlyCents: Number(company?.monthly_fee ?? 0) * 100,
        months,
        discountPercent: plan?.discount_percent,
        configuredMonthlyCents: plan?.monthly_cents,
        configuredMonths: plan?.cycle_months,
        configuredTotalCents: plan?.cycle_total_cents,
      }).totalCents / 100
    );
  };

  const openDialog = (m: DialogMode, cid?: string) => {
    if (cid) {
      setSelectedId(cid);
      const c: any = companies.find((x: any) => x.id === cid);
      if (c?.monthly_fee) setAmount(String(cycleAmount(c)));
      if (c?.next_due_at) setNewDue(c.next_due_at);
    }
    setMode(m);
  };

  const closeDialog = () => {
    setMode(null);
    setNote("");
  };

  const registerPayment = useMutation({
    mutationFn: async () => {
      const { data: inserted, error } = await (supabase.rpc as any)(
        "register_subscription_payment",
        {
          _company_id: selectedId,
          _gross_amount: Number(amount),
          _note: note || null,
        },
      );
      if (error) throw error;
      return inserted;
    },
    onSuccess: (inserted) => {
      toast.success(
        inserted?.discount_amount > 0
          ? `Pagamento registrado com ${inserted.discount_percent}% de desconto por indicação`
          : "Pagamento registrado — gerando comprovante",
      );
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-companies-billing"] });
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      // Auto-generate receipt PDF
      if (inserted && selected) {
        generatePaymentReceipt({
          receiptNumber: String(inserted.id).slice(0, 8).toUpperCase(),
          companyName: selected.name,
          companySlug: selected.slug,
          amount: Number(inserted.amount),
          paidAt: inserted.paid_at,
          note: inserted.note,
          pixHolder: settings?.pix_holder,
          pixKey: settings?.pix_key,
        });
      }
      closeDialog();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const changeDue = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("companies")
        .update({ next_due_at: newDue })
        .eq("id", selectedId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vencimento atualizado");
      qc.invalidateQueries({ queryKey: ["admin-companies-billing"] });
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
      closeDialog();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const toggleSuspend = useMutation({
    mutationFn: async (suspend: boolean) => {
      const { error } = await supabase
        .from("companies")
        .update({ suspended_at: suspend ? new Date().toISOString() : null })
        .eq("id", selectedId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["admin-companies-billing"] });
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
      closeDialog();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const chargeMessage = useMemo(() => {
    if (!selected) return "";
    const due = selected.next_due_at ? dateBR(selected.next_due_at) : "—";
    const gross = Number(amount || selected.monthly_fee || 49.9);
    const discountPercent = Number(nextReferral?.reward_percent ?? 0);
    const discount = Math.round(gross * discountPercent) / 100;
    const val = brl(Math.max(0, gross - discount));
    return [
      `Olá! 😊`,
      ``,
      `Sua assinatura do sistema vence em:`,
      ``,
      `Data: ${due}`,
      `Valor: ${val}`,
      discountPercent ? `Desconto por indicação: ${discountPercent}% (${brl(discount)})` : "",
      ``,
      `PIX: ${settings?.pix_key ?? "(configure em Configurações)"}`,
      settings?.pix_holder ? `Titular: ${settings.pix_holder}` : "",
      settings?.pix_bank ? `Banco: ${settings.pix_bank}` : "",
      ``,
      `Obrigado pela parceria! 💙`,
    ]
      .filter(Boolean)
      .join("\n");
  }, [selected, amount, settings, nextReferral]);

  const copyMessage = async () => {
    await navigator.clipboard.writeText(chargeMessage);
    toast.success("Mensagem copiada");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Assinaturas & Pagamentos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gere cobranças, registre PIX, ajuste vencimento e suspenda empresas.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Empresas — status de assinatura</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3 pl-6">Empresa</th>
                  <th className="text-left p-3">Valor do ciclo</th>
                  <th className="text-left p-3">Próx. venc.</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3 pr-6">Ações</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c: any) => {
                  const s = statusLabel[c.status] ?? {
                    label: c.status,
                    className: "bg-muted",
                    dot: "bg-muted-foreground",
                  };
                  const suspended = !!c.suspended_at;
                  return (
                    <tr key={c.id} className="border-t border-border/60 hover:bg-muted/30">
                      <td className="p-3 pl-6">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">/{c.slug}</p>
                      </td>
                      <td className="p-3">
                        <p>{brl(cycleAmount(c))}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.plan_cycle_months ?? 1} {c.plan_cycle_months === 1 ? "mês" : "meses"} ·{" "}
                          {brl(Number(c.monthly_fee ?? 0))}/mês
                        </p>
                      </td>
                      <td className="p-3 text-muted-foreground">{dateBR(c.next_due_at)}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${s.className}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </td>
                      <td className="p-3 pr-6">
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDialog("charge", c.id)}
                          >
                            <MessageCircle className="h-3.5 w-3.5 mr-1" /> Cobrança
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDialog("register", c.id)}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Pagamento
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDialog("due", c.id)}
                          >
                            <CalendarClock className="h-3.5 w-3.5 mr-1" /> Vencimento
                          </Button>
                          <Button
                            size="sm"
                            variant={suspended ? "default" : "outline"}
                            onClick={() => openDialog("suspend", c.id)}
                          >
                            {suspended ? (
                              <>
                                <PlayCircle className="h-3.5 w-3.5 mr-1" /> Reativar
                              </>
                            ) : (
                              <>
                                <PauseCircle className="h-3.5 w-3.5 mr-1" /> Suspender
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {companies.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                      Nenhuma empresa cadastrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos pagamentos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : payments.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhum pagamento registrado ainda.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3 pl-6">Empresa</th>
                    <th className="text-left p-3">Valor</th>
                    <th className="text-left p-3">Desconto</th>
                    <th className="text-left p-3">Pago em</th>
                    <th className="text-left p-3">Observação</th>
                    <th className="text-right p-3 pr-6">Comprovante</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p: any) => (
                    <tr key={p.id} className="border-t border-border/60 hover:bg-muted/30">
                      <td className="p-3 pl-6">
                        <p className="font-medium">{p.companies?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">/{p.companies?.slug}</p>
                      </td>
                      <td className="p-3 font-medium">
                        {brl(Number(p.amount))}
                        {Number(p.gross_amount ?? p.amount) !== Number(p.amount) && (
                          <p className="text-xs font-normal text-muted-foreground line-through">
                            {brl(Number(p.gross_amount))}
                          </p>
                        )}
                      </td>
                      <td className="p-3">
                        {Number(p.referral_discount_amount) > 0 ? (
                          <BadgePercentLabel
                            percent={p.referral_discount_percent}
                            amount={p.referral_discount_amount}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{dateBR(p.paid_at)}</td>
                      <td className="p-3 text-muted-foreground">{p.note ?? "—"}</td>
                      <td className="p-3 pr-6 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            generatePaymentReceipt({
                              receiptNumber: String(p.id).slice(0, 8).toUpperCase(),
                              companyName: p.companies?.name ?? "—",
                              companySlug: p.companies?.slug,
                              amount: Number(p.amount),
                              paidAt: p.paid_at,
                              note: p.note,
                              pixHolder: settings?.pix_holder,
                              pixKey: settings?.pix_key,
                            })
                          }
                        >
                          <FileDown className="h-3.5 w-3.5 mr-1.5" /> PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Register payment */}
      <Dialog open={mode === "register"} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento — {selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Observação</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Ao confirmar, o sistema aplica automaticamente no máximo um desconto de indicação
              disponível e avança o vencimento.
            </p>
          </div>
          <DialogFooter>
            <Button
              disabled={!amount || registerPayment.isPending}
              onClick={() => registerPayment.mutate()}
            >
              {registerPayment.isPending ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate charge */}
      <Dialog open={mode === "charge"} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar cobrança — {selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Mensagem (PIX)</Label>
              <textarea
                className="w-full min-h-[220px] rounded-md border border-input bg-background p-3 text-sm font-mono"
                value={chargeMessage}
                readOnly
              />
            </div>
            {!settings?.pix_key && (
              <p className="text-xs text-destructive">
                Configure a chave PIX em Configurações antes de enviar.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={copyMessage}>
              <Copy className="h-4 w-4 mr-2" /> Copiar
            </Button>
            <Button
              onClick={() => {
                openWhatsAppLink(waLink(null, chargeMessage));
              }}
            >
              <MessageCircle className="h-4 w-4 mr-2" /> Enviar por WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change due date */}
      <Dialog open={mode === "due"} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar vencimento — {selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Novo vencimento</Label>
              <Input
                type="date"
                value={newDue?.slice(0, 10) ?? ""}
                onChange={(e) => setNewDue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={!newDue || changeDue.isPending} onClick={() => changeDue.mutate()}>
              {changeDue.isPending ? "Salvando…" : "Atualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend / reactivate */}
      <Dialog open={mode === "suspend"} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected?.suspended_at ? "Reativar empresa" : "Suspender empresa"} — {selected?.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {selected?.suspended_at
              ? "A empresa voltará a operar normalmente."
              : "A empresa será marcada como suspensa. O acesso operacional pode ser bloqueado conforme sua política interna."}
          </p>
          <DialogFooter>
            <Button
              variant={selected?.suspended_at ? "default" : "destructive"}
              disabled={toggleSuspend.isPending}
              onClick={() => toggleSuspend.mutate(!selected?.suspended_at)}
            >
              {toggleSuspend.isPending
                ? "Salvando…"
                : selected?.suspended_at
                  ? "Reativar"
                  : "Suspender"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BadgePercentLabel({ percent, amount }: { percent: number | null; amount: number }) {
  return (
    <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700">
      {Number(percent)}% · {brl(Number(amount))}
    </span>
  );
}
