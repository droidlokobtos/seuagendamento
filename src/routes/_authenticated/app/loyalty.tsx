import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Award, Gift } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/loyalty")({
  component: Loyalty,
});

type Program = {
  id: string; points_per_brl: number; cashback_percent: number;
  min_points_redeem: number; point_value_brl: number; active: boolean;
};
type Tx = {
  id: string; customer_id: string; kind: string;
  points: number; cashback_amount: number; reference: string | null;
  notes: string | null; created_at: string;
};
type Customer = { id: string; name: string; phone: string | null };

function Loyalty() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const [open, setOpen] = useState(false);

  const { data: program } = useQuery({
    queryKey: ["loyalty_program", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_programs").select("*")
        .eq("company_id", activeCompany!.id).maybeSingle();
      return data as Program | null;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["loyalty_customers", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data } = await supabase
        .from("customers").select("id,name,phone")
        .eq("company_id", activeCompany!.id).order("name");
      return (data ?? []) as Customer[];
    },
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["loyalty_tx", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_transactions").select("*")
        .eq("company_id", activeCompany!.id)
        .order("created_at", { ascending: false }).limit(100);
      return (data ?? []) as Tx[];
    },
  });

  const balances = useMemo(() => {
    const m = new Map<string, { points: number; cashback: number }>();
    for (const t of txs) {
      const b = m.get(t.customer_id) ?? { points: 0, cashback: 0 };
      const sign = t.kind.startsWith("redeem") ? -1 : 1;
      b.points += sign * t.points;
      b.cashback += sign * Number(t.cashback_amount);
      m.set(t.customer_id, b);
    }
    return m;
  }, [txs]);

  const saveProgram = useMutation({
    mutationFn: async (p: Partial<Program>) => {
      const row = { ...p, company_id: activeCompany!.id };
      const { error } = await supabase.from("loyalty_programs")
        .upsert(row, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loyalty_program"] });
      toast.success("Programa salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTx = useMutation({
    mutationFn: async (payload: Partial<Tx>) => {
      const { error } = await supabase.from("loyalty_transactions")
        .insert({ ...payload, company_id: activeCompany!.id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loyalty_tx"] });
      toast.success("Lançamento registrado");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";
  const kindLabel: Record<string, string> = {
    earn_points: "Ganhou pontos",
    redeem_points: "Resgatou pontos",
    earn_cashback: "Ganhou cashback",
    redeem_cashback: "Resgatou cashback",
    adjustment: "Ajuste",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Fidelidade & Cashback</h1>
        <p className="text-sm text-muted-foreground">Recompense clientes recorrentes.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" /> Programa</CardTitle></CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              saveProgram.mutate({
                points_per_brl: Number(f.get("points_per_brl")),
                cashback_percent: Number(f.get("cashback_percent")),
                min_points_redeem: Number(f.get("min_points_redeem")),
                point_value_brl: Number(f.get("point_value_brl")),
                active: f.get("active") === "on",
              });
            }}
          >
            <div>
              <Label>Pontos por R$ 1,00</Label>
              <Input name="points_per_brl" type="number" step="0.01" defaultValue={program?.points_per_brl ?? 1} />
            </div>
            <div>
              <Label>Valor de cada ponto (R$)</Label>
              <Input name="point_value_brl" type="number" step="0.01" defaultValue={program?.point_value_brl ?? 0.10} />
            </div>
            <div>
              <Label>Mínimo de pontos para resgate</Label>
              <Input name="min_points_redeem" type="number" defaultValue={program?.min_points_redeem ?? 100} />
            </div>
            <div>
              <Label>Cashback (%)</Label>
              <Input name="cashback_percent" type="number" step="0.01" defaultValue={program?.cashback_percent ?? 0} />
            </div>
            <div className="flex items-center gap-2">
              <Switch name="active" defaultChecked={program?.active ?? true} />
              <Label>Programa ativo</Label>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={saveProgram.isPending}>Salvar programa</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4" /> Saldo dos clientes</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Lançamento</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  addTx.mutate({
                    customer_id: String(f.get("customer_id")),
                    kind: String(f.get("kind")),
                    points: Number(f.get("points") || 0),
                    cashback_amount: Number(f.get("cashback_amount") || 0),
                    notes: String(f.get("notes") || "") || null,
                  });
                }}
              >
                <div>
                  <Label>Cliente</Label>
                  <Select name="customer_id" required>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select name="kind" defaultValue="earn_points">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="earn_points">Ganhar pontos</SelectItem>
                      <SelectItem value="redeem_points">Resgatar pontos</SelectItem>
                      <SelectItem value="earn_cashback">Ganhar cashback</SelectItem>
                      <SelectItem value="redeem_cashback">Resgatar cashback</SelectItem>
                      <SelectItem value="adjustment">Ajuste</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Pontos</Label><Input name="points" type="number" defaultValue={0} /></div>
                  <div><Label>Cashback (R$)</Label><Input name="cashback_amount" type="number" step="0.01" defaultValue={0} /></div>
                </div>
                <div><Label>Observação</Label><Input name="notes" /></div>
                <DialogFooter><Button type="submit" disabled={addTx.isPending}>Registrar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {balances.size === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum lançamento ainda.</p>
          ) : (
            <div className="divide-y">
              {Array.from(balances.entries())
                .sort((a, b) => b[1].points - a[1].points)
                .map(([cid, b]) => (
                  <div key={cid} className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium">{customerName(cid)}</span>
                    <div className="text-right text-sm">
                      <p><span className="font-semibold text-primary">{b.points}</span> pts</p>
                      <p className="text-xs text-muted-foreground">{brl(b.cashback * 100)} cashback</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimos lançamentos</CardTitle></CardHeader>
        <CardContent>
          {txs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">—</p>
          ) : (
            <div className="divide-y text-sm">
              {txs.map((t) => (
                <div key={t.id} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{customerName(t.customer_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {kindLabel[t.kind] ?? t.kind}
                      {t.notes ? ` · ${t.notes}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    {t.points !== 0 && <p>{t.kind.startsWith("redeem") ? "-" : "+"}{t.points} pts</p>}
                    {Number(t.cashback_amount) !== 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t.kind.startsWith("redeem") ? "-" : "+"}{brl(Number(t.cashback_amount) * 100)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
