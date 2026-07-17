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
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Scissors } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/services")({
  component: Services,
});

type S = {
  id: string; name: string; description: string | null;
  duration_min: number; price_cents: number; category: string | null;
  color: string | null; active: boolean; photo_url: string | null;
};

function Services() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const [edit, setEdit] = useState<S | null>(null);
  const [open, setOpen] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["services", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("company_id", companyId).order("name");
      if (error) throw error;
      return (data ?? []) as S[];
    },
  });

  const categories = useMemo(
    () => Array.from(new Set(data.map((s) => s.category).filter(Boolean))) as string[],
    [data],
  );

  const save = useMutation({
    mutationFn: async (v: Partial<S>) => {
      const payload = { ...v, company_id: companyId };
      if (edit) {
        const { error } = await supabase.from("services").update(v).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(edit ? "Serviço atualizado" : "Serviço criado");
      qc.invalidateQueries({ queryKey: ["services", companyId] });
      setOpen(false); setEdit(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["services", companyId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Serviços</h1>
          <p className="text-sm text-muted-foreground">Cadastre os serviços oferecidos.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEdit(null)}><Plus className="h-4 w-4 mr-2" /> Novo serviço</Button>
          </DialogTrigger>
          <ServiceDialog edit={edit} onSave={(v) => save.mutate(v)} loading={save.isPending} categories={categories} />
        </Dialog>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : !data.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Scissors className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhum serviço cadastrado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => (
            <Card key={s.id} className={!s.active ? "opacity-60 overflow-hidden" : "overflow-hidden"}>
              {s.photo_url && (
                <div className="h-32 w-full bg-muted">
                  <img src={s.photo_url} alt={s.name} className="h-full w-full object-cover" />
                </div>
              )}
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: s.color ?? "#8b7355" }} />
                      <p className="font-medium truncate">{s.name}</p>
                    </div>
                    {s.category && <p className="text-xs text-muted-foreground mt-0.5">{s.category}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEdit(s); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(s.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.duration_min} min</span>
                  <span className="font-semibold">{brl(s.price_cents / 100)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceDialog({
  edit, onSave, loading, categories,
}: { edit: S | null; onSave: (v: Partial<S>) => void; loading: boolean; categories: string[] }) {
  const [f, setF] = useState<Partial<S>>(
    edit ?? { name: "", duration_min: 30, price_cents: 0, color: "#8b7355", active: true },
  );

  return (
    <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{edit ? "Editar serviço" : "Novo serviço"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        {f.photo_url && (
          <div className="h-32 w-full rounded-md overflow-hidden bg-muted">
            <img src={f.photo_url} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div>
          <Label>URL da foto</Label>
          <Input placeholder="https://…" value={f.photo_url ?? ""}
            onChange={(e) => setF({ ...f, photo_url: e.target.value })} />
        </div>
        <div>
          <Label>Nome</Label>
          <Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Duração (min)</Label>
            <Input type="number" value={f.duration_min ?? 30}
              onChange={(e) => setF({ ...f, duration_min: parseInt(e.target.value || "0", 10) })} />
          </div>
          <div>
            <Label>Preço (R$)</Label>
            <Input type="number" step="0.01" value={((f.price_cents ?? 0) / 100).toString()}
              onChange={(e) => setF({ ...f, price_cents: Math.round(parseFloat(e.target.value || "0") * 100) })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Categoria</Label>
            <Input list="svc-categories" value={f.category ?? ""}
              onChange={(e) => setF({ ...f, category: e.target.value })} />
            <datalist id="svc-categories">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <Label>Cor</Label>
            <Input type="color" value={f.color ?? "#8b7355"} onChange={(e) => setF({ ...f, color: e.target.value })} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label>Ativo</Label>
          <Switch checked={f.active ?? true} onCheckedChange={(v) => setF({ ...f, active: v })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(f)} disabled={loading || !f.name}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}
