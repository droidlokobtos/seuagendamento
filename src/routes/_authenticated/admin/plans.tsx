import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/plans")({ component: PlansAdmin });

type Plan = {
  code: string;
  name: string;
  description: string | null;
  monthly_cents: number;
  cycle_months: number | null;
  cycle_total_cents: number | null;
  discount_percent: number | null;
  max_users: number | null;
  selectable: boolean;
  active: boolean;
  sort_order: number;
};

function moneyToCents(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function PlansAdmin() {
  const qc = useQueryClient();
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["admin-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscription_plans").select("code,name,description,monthly_cents,cycle_months,cycle_total_cents,discount_percent,max_users,selectable,active,sort_order").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando planos...</p>;

  return <div className="max-w-5xl mx-auto space-y-6">
    <div><h2 className="text-2xl font-semibold tracking-tight">Planos</h2><p className="mt-1 text-sm text-muted-foreground">Edite preços, ciclos, limites e disponibilidade dos planos oferecidos pela plataforma.</p></div>
    <div className="grid gap-4 lg:grid-cols-2">{plans.map((plan) => <PlanEditor key={plan.code} plan={plan} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-subscription-plans"] })} />)}</div>
  </div>;
}

function PlanEditor({ plan, onSaved }: { plan: Plan; onSaved: () => void }) {
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? "");
  const [monthly, setMonthly] = useState((plan.monthly_cents / 100).toFixed(2));
  const [cycleMonths, setCycleMonths] = useState(plan.cycle_months == null ? "" : String(plan.cycle_months));
  const [cycleTotal, setCycleTotal] = useState(plan.cycle_total_cents == null ? "" : (plan.cycle_total_cents / 100).toFixed(2));
  const [discount, setDiscount] = useState(String(plan.discount_percent ?? 0));
  const [maxUsers, setMaxUsers] = useState(plan.max_users == null ? "" : String(plan.max_users));
  const [selectable, setSelectable] = useState(plan.selectable);
  const [active, setActive] = useState(plan.active);

  useEffect(() => {
    setName(plan.name); setDescription(plan.description ?? ""); setMonthly((plan.monthly_cents / 100).toFixed(2)); setCycleMonths(plan.cycle_months == null ? "" : String(plan.cycle_months)); setCycleTotal(plan.cycle_total_cents == null ? "" : (plan.cycle_total_cents / 100).toFixed(2)); setDiscount(String(plan.discount_percent ?? 0)); setMaxUsers(plan.max_users == null ? "" : String(plan.max_users)); setSelectable(plan.selectable); setActive(plan.active);
  }, [plan]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        monthly_cents: moneyToCents(monthly),
        cycle_months: cycleMonths ? Math.max(1, Number(cycleMonths)) : null,
        cycle_total_cents: cycleTotal ? moneyToCents(cycleTotal) : null,
        discount_percent: Math.max(0, Number(discount || 0)),
        max_users: maxUsers ? Math.max(1, Number(maxUsers)) : null,
        selectable,
        active,
        updated_at: new Date().toISOString(),
      };
      if (!payload.name) throw new Error("Informe o nome do plano.");
      const { error } = await supabase.from("subscription_plans").update(payload as any).eq("code", plan.code);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(`Plano ${name} atualizado`); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar plano"),
  });

  return <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base">{plan.name}</CardTitle><p className="text-xs text-muted-foreground mt-1">Código: {plan.code}</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Ativo</span><Switch checked={active} onCheckedChange={setActive} /></div></div></CardHeader><CardContent className="space-y-4">
    <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
    <div><Label>Descrição</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
    <div className="grid grid-cols-2 gap-3"><div><Label>Mensalidade (R$)</Label><Input inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></div><div><Label>Máx. usuários</Label><Input type="number" min={1} placeholder="Ilimitado" value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} /></div></div>
    <div className="grid grid-cols-3 gap-3"><div><Label>Ciclo (meses)</Label><Input type="number" min={1} value={cycleMonths} onChange={(e) => setCycleMonths(e.target.value)} /></div><div><Label>Total ciclo (R$)</Label><Input inputMode="decimal" value={cycleTotal} onChange={(e) => setCycleTotal(e.target.value)} /></div><div><Label>Desconto %</Label><Input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} /></div></div>
    <div className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">Disponível para contratação</p><p className="text-xs text-muted-foreground">Controla se o plano pode ser escolhido por clientes.</p></div><Switch checked={selectable} onCheckedChange={setSelectable} /></div>
    <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Salvando..." : "Salvar plano"}</Button>
  </CardContent></Card>;
}
