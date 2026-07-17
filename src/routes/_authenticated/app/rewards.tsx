import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Gift } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/rewards")({ component: Rewards });

type R = { id: string; name: string; description: string | null; points_cost: number; stock: number | null; active: boolean };

function Rewards() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<R | null>(null);

  const { data: rewards = [] } = useQuery({
    queryKey: ["rewards", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase.from("loyalty_rewards").select("*")
        .eq("company_id", activeCompany!.id).order("points_cost");
      if (error) throw error;
      return data as R[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (p: Partial<R>) => {
      if (editing) {
        const { error } = await supabase.from("loyalty_rewards").update(p).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("loyalty_rewards").insert({ ...p, company_id: activeCompany!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rewards"] }); setOpen(false); setEditing(null); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("loyalty_rewards").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rewards"] }); toast.success("Removido"); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Recompensas</h1>
          <p className="text-sm text-muted-foreground">Catálogo de prêmios resgatáveis com pontos.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button onClick={() => setEditing(null)}><Plus className="mr-2 h-4 w-4" />Nova recompensa</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} recompensa</DialogTitle></DialogHeader>
            <RewardForm initial={editing} onSubmit={(p) => upsert.mutate(p)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {rewards.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /><span className="font-medium">{r.name}</span></div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
              <div className="text-sm"><b>{r.points_cost}</b> pts{r.stock != null && <> · estoque: {r.stock}</>} · {r.active ? "Ativa" : "Inativa"}</div>
            </CardContent>
          </Card>
        ))}
        {rewards.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma recompensa cadastrada.</p>}
      </div>
    </div>
  );
}

function RewardForm({ initial, onSubmit }: { initial: R | null; onSubmit: (p: Partial<R>) => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    points_cost: initial?.points_cost ?? 100,
    stock: initial?.stock ?? null as number | null,
    active: initial?.active ?? true,
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
      <div><Label>Nome</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><Label>Descrição</Label><Textarea value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Custo (pts)</Label><Input type="number" min={1} required value={f.points_cost} onChange={(e) => setF({ ...f, points_cost: +e.target.value })} /></div>
        <div><Label>Estoque (opcional)</Label><Input type="number" min={0} value={f.stock ?? ""} onChange={(e) => setF({ ...f, stock: e.target.value === "" ? null : +e.target.value })} /></div>
      </div>
      <div className="flex items-center gap-2"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /><Label>Ativa</Label></div>
      <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
    </form>
  );
}
