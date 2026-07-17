import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { brl, brDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/finances")({
  component: Finances,
});

type Tx = {
  id: string;
  type: "income" | "expense";
  category: string;
  description: string | null;
  amount: number;
  occurred_on: string;
  payment_method_id: string | null;
};

type PM = { id: string; name: string };

function Finances() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const from = `${month}-01`;
  const to = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 1)
    .toISOString().slice(0, 10);

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["finances", companyId, month],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_transactions")
        .select("*").eq("company_id", companyId)
        .gte("occurred_on", from).lt("occurred_on", to)
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Tx[];
    },
  });

  const { data: methods = [] } = useQuery({
    queryKey: ["payment_methods", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_methods")
        .select("id,name").eq("company_id", companyId);
      if (error) throw error;
      return (data ?? []) as PM[];
    },
  });

  const totals = useMemo(() => {
    const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { income, expense, balance: income - expense };
  }, [txs]);

  const save = useMutation({
    mutationFn: async (v: Partial<Tx>) => {
      const { error } = await supabase.from("financial_transactions")
        .insert({ ...v, company_id: companyId } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento registrado");
      qc.invalidateQueries({ queryKey: ["finances", companyId] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["finances", companyId] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Controle de entradas e saídas.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Novo lançamento</Button>
            </DialogTrigger>
            <TxDialog methods={methods} onSave={(v) => save.mutate(v)} loading={save.isPending} />
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Entradas" value={totals.income} icon={<TrendingUp className="h-5 w-5" />} tone="text-emerald-600" />
        <StatCard label="Saídas" value={totals.expense} icon={<TrendingDown className="h-5 w-5" />} tone="text-rose-600" />
        <StatCard label="Saldo" value={totals.balance} icon={<Wallet className="h-5 w-5" />} tone={totals.balance >= 0 ? "text-primary" : "text-rose-600"} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Carregando…</div>
          ) : !txs.length ? (
            <div className="p-12 text-center text-muted-foreground">Sem lançamentos neste mês.</div>
          ) : (
            <div className="divide-y">
              {txs.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.category}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {brDate(t.occurred_on)}{t.description ? ` · ${t.description}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-semibold ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                      {t.type === "income" ? "+" : "-"} {brl(Number(t.amount))}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => confirm("Remover?") && del.mutate(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className={tone}>{icon}</span>
        </div>
        <p className={`mt-2 text-2xl font-semibold ${tone}`}>{brl(value)}</p>
      </CardContent>
    </Card>
  );
}

function TxDialog({ methods, onSave, loading }: {
  methods: PM[]; onSave: (v: Partial<Tx>) => void; loading: boolean;
}) {
  const [f, setF] = useState<Partial<Tx>>({
    type: "income",
    category: "",
    amount: 0,
    occurred_on: new Date().toISOString().slice(0, 10),
  });

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Novo lançamento</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Entrada</SelectItem>
                <SelectItem value="expense">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={f.occurred_on ?? ""} onChange={(e) => setF({ ...f, occurred_on: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Categoria</Label>
          <Input value={f.category ?? ""} onChange={(e) => setF({ ...f, category: e.target.value })}
            placeholder="Ex: Serviço, Aluguel, Produtos" />
        </div>
        <div>
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" value={f.amount ?? 0}
            onChange={(e) => setF({ ...f, amount: parseFloat(e.target.value || "0") })} />
        </div>
        {methods.length > 0 && (
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={f.payment_method_id ?? ""} onValueChange={(v) => setF({ ...f, payment_method_id: v || null })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {methods.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label>Descrição</Label>
          <Textarea value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(f)} disabled={loading || !f.category || !f.amount}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}
