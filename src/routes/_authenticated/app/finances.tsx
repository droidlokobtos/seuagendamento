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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, Download } from "lucide-react";
import { brl, dateBR } from "@/lib/format";
import { DEFAULT_EXPENSE_CATEGORIES, downloadCSV } from "@/lib/commerce";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/finances")({
  component: Finances,
  head: () => ({
    meta: [
      { title: "Financeiro · Receitas, despesas e fluxo de caixa" },
      { name: "description", content: "Controle receitas, despesas por categoria, formas de pagamento e fluxo de caixa do seu negócio em um só lugar." },
      { property: "og:title", content: "Financeiro do negócio" },
      { property: "og:description", content: "Receitas, despesas, formas de pagamento e fluxo de caixa integrados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tx = {
  id: string;
  type: "income" | "expense";
  category: string;
  description: string | null;
  amount: number;
  occurred_on: string;
  payment_method_id: string | null;
  sale_id: string | null;
  appointment_id: string | null;
};

type Option = { id: string; name: string; active: boolean; sort_order: number };
type ExpenseCat = { id: string; name: string; active: boolean };

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
      return (data ?? []) as unknown as Tx[];
    },
  });

  const { data: options = [] } = useQuery({
    queryKey: ["payment_options", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_options")
        .select("*").eq("company_id", companyId).order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as Option[];
    },
  });

  const { data: expenseCats = [] } = useQuery({
    queryKey: ["expense_categories", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories")
        .select("*").eq("company_id", companyId).order("name");
      if (error) throw error;
      return (data ?? []) as unknown as ExpenseCat[];
    },
  });

  const totals = useMemo(() => {
    const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { income, expense, balance: income - expense };
  }, [txs]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txs.filter((x) => x.type === "expense")) {
      map.set(t.category, (map.get(t.category) ?? 0) + Number(t.amount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
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
    onError: (e: any) => toast.error(e.message),
  });

  const exportCSV = () => {
    downloadCSV(`financeiro-${month}.csv`, [
      ["Data", "Tipo", "Categoria", "Descrição", "Valor"],
      ...txs.map((t) => [
        dateBR(t.occurred_on), t.type === "income" ? "Entrada" : "Saída",
        t.category, t.description ?? "", Number(t.amount).toFixed(2),
      ]),
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Receitas de atendimentos e vendas, despesas por categoria e fluxo de caixa.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Exportar</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Novo lançamento</Button>
            </DialogTrigger>
            {open && (
              <TxDialog expenseCats={expenseCats}
                onSave={(v) => save.mutate(v)} loading={save.isPending} />
            )}
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Entradas" value={totals.income} icon={<TrendingUp className="h-5 w-5" />} tone="text-emerald-600" />
        <StatCard label="Saídas" value={totals.expense} icon={<TrendingDown className="h-5 w-5" />} tone="text-rose-600" />
        <StatCard label="Saldo do mês" value={totals.balance} icon={<Wallet className="h-5 w-5" />} tone={totals.balance >= 0 ? "text-primary" : "text-rose-600"} />
      </div>

      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries">Lançamentos</TabsTrigger>
          <TabsTrigger value="analysis">Análise</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="mt-4">
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
                          {dateBR(t.occurred_on)}{t.description ? ` · ${t.description}` : ""}
                          {t.sale_id ? " · venda" : t.appointment_id ? " · atendimento" : ""}
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
        </TabsContent>

        <TabsContent value="analysis" className="mt-4">
          <Card>
            <CardContent className="p-5 space-y-3">
              <p className="text-sm font-medium">Despesas por categoria</p>
              {!byCategory.length ? (
                <p className="text-sm text-muted-foreground">Sem despesas neste mês.</p>
              ) : (
                byCategory.map(([cat, val]) => {
                  const pct = totals.expense ? Math.round((val / totals.expense) * 100) : 0;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="truncate">{cat}</span>
                        <span className="font-medium">{brl(val)} · {pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-rose-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="mt-4 grid gap-4 md:grid-cols-2">
          <SimpleList
            title="Formas de pagamento"
            hint="Usadas nas vendas e nos recebimentos."
            table="payment_options"
            companyId={companyId}
            queryKey={["payment_options", companyId]}
            rows={options.map((o) => ({ id: o.id, name: o.name }))}
            suggestions={["Dinheiro", "PIX", "Cartão de crédito", "Cartão de débito", "Transferência"]}
          />
          <SimpleList
            title="Categorias de despesa"
            hint="Organizam as saídas no fluxo de caixa."
            table="expense_categories"
            companyId={companyId}
            queryKey={["expense_categories", companyId]}
            rows={expenseCats.map((c) => ({ id: c.id, name: c.name }))}
            suggestions={DEFAULT_EXPENSE_CATEGORIES}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SimpleList({ title, hint, table, companyId, queryKey, rows, suggestions }: {
  title: string; hint: string; table: "payment_options" | "expense_categories";
  companyId: string; queryKey: unknown[]; rows: { id: string; name: string }[];
  suggestions: string[];
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const add = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase.from(table)
        .insert({ company_id: companyId, name: value } as any);
      if (error) throw error;
    },
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error(e.message),
  });

  const missing = suggestions.filter((s) => !rows.some((r) => r.name.toLowerCase() === s.toLowerCase()));

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Adicionar…" />
          <Button onClick={() => name.trim() && add.mutate(name.trim())} disabled={add.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {missing.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {missing.map((s) => (
              <Button key={s} size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => add.mutate(s)}>+ {s}</Button>
            ))}
          </div>
        )}
        {rows.length > 0 && (
          <div className="divide-y rounded-md border">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm truncate">{r.name}</span>
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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

function TxDialog({ expenseCats, onSave, loading }: {
  expenseCats: ExpenseCat[];
  onSave: (v: Partial<Tx>) => void; loading: boolean;
}) {
  const [f, setF] = useState<Partial<Tx>>({
    type: "expense",
    category: "",
    amount: 0,
    occurred_on: new Date().toISOString().slice(0, 10),
  });

  const cats = f.type === "expense"
    ? (expenseCats.length ? expenseCats.map((c) => c.name) : DEFAULT_EXPENSE_CATEGORIES)
    : ["Serviços", "Vendas", "Outros"];

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Novo lançamento</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as any, category: "" })}>
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
          <Select value={f.category ?? ""} onValueChange={(v) => setF({ ...f, category: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" value={f.amount ?? 0}
            onChange={(e) => setF({ ...f, amount: parseFloat(e.target.value || "0") })} />
        </div>
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
