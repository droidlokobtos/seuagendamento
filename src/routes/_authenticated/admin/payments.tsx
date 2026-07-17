import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { brl, dateBR } from "@/lib/format";
import { CreditCard, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: Payments,
});

function Payments() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [amount, setAmount] = useState("49.90");
  const [note, setNote] = useState("");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () =>
      (await supabase
        .from("payments")
        .select("*, companies(name, slug)")
        .order("paid_at", { ascending: false })).data ?? [],
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-min"],
    queryFn: async () => (await supabase.from("companies").select("id, name, monthly_fee, next_due_at").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payments").insert({
        company_id: companyId,
        amount: Number(amount),
        note: note || null,
        paid_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento registrado");
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setOpen(false); setNote("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Pagamentos</h2>
          <p className="text-sm text-muted-foreground mt-1">Registre manualmente os PIX confirmados das empresas.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Registrar pagamento</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar pagamento PIX</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Empresa</Label>
                <Select value={companyId} onValueChange={(v) => {
                  setCompanyId(v);
                  const c: any = companies.find((x: any) => x.id === v);
                  if (c?.monthly_fee) setAmount(String(c.monthly_fee));
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div><Label>Observação</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></div>
            </div>
            <DialogFooter>
              <Button disabled={!companyId || !amount || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? "Salvando…" : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : payments.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3 pl-6">Empresa</th>
                    <th className="text-left p-3">Valor</th>
                    <th className="text-left p-3">Pago em</th>
                    <th className="text-left p-3 pr-6">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p: any) => (
                    <tr key={p.id} className="border-t border-border/60 hover:bg-muted/30">
                      <td className="p-3 pl-6">
                        <p className="font-medium">{p.companies?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">/{p.companies?.slug}</p>
                      </td>
                      <td className="p-3 font-medium">{brl(Number(p.amount))}</td>
                      <td className="p-3 text-muted-foreground">{dateBR(p.paid_at)}</td>
                      <td className="p-3 pr-6 text-muted-foreground">{p.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
