import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Tag, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/niches")({
  component: Niches,
});

function Niches() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [managing, setManaging] = useState<{ id: string; name: string } | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["niches-admin"],
    queryFn: async () => (await supabase.from("niches").select("*").order("name")).data ?? [],
  });

  const { data: subCounts = {} } = useQuery({
    queryKey: ["sub-niches-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("sub_niches" as any).select("niche_id");
      const map: Record<string, number> = {};
      (data as any[] | null)?.forEach((r) => { map[r.niche_id] = (map[r.niche_id] ?? 0) + 1; });
      return map;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("niches").insert({ name, icon: icon || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nicho criado");
      qc.invalidateQueries({ queryKey: ["niches-admin"] });
      setOpen(false); setName(""); setIcon("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Nichos</h2>
          <p className="text-sm text-muted-foreground mt-1">Segmentos disponíveis e seus sub-nichos.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo nicho</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo nicho</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Estética Facial" /></div>
              <div><Label>Ícone (opcional)</Label><Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Emoji ou nome do ícone" /></div>
            </div>
            <DialogFooter>
              <Button disabled={!name || mutation.isPending} onClick={() => mutation.mutate()}>
                {mutation.isPending ? "Criando…" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((n: any) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setManaging({ id: n.id, name: n.name })}
              className="text-left"
            >
              <Card className="hover:border-primary/40 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent-foreground text-lg">
                      {n.icon ?? <Tag className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{n.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(n.suggested_services as any[])?.length ?? 0} serviços sugeridos · {subCounts[n.id] ?? 0} sub-nichos
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <SubNichesDialog
        niche={managing}
        onClose={() => { setManaging(null); qc.invalidateQueries({ queryKey: ["sub-niches-counts"] }); }}
      />
    </div>
  );
}

function SubNichesDialog({ niche, onClose }: { niche: { id: string; name: string } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["sub-niches-of", niche?.id],
    enabled: !!niche,
    queryFn: async () =>
      (await supabase.from("sub_niches" as any).select("*").eq("niche_id", niche!.id).order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sub_niches" as any).insert({
        niche_id: niche!.id,
        name: newName.trim(),
        icon: newIcon || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sub-nicho criado");
      setNewName(""); setNewIcon("");
      qc.invalidateQueries({ queryKey: ["sub-niches-of", niche?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sub_niches" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sub-nicho removido");
      qc.invalidateQueries({ queryKey: ["sub-niches-of", niche?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <Dialog open={!!niche} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Sub-nichos — {niche?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_120px_auto] gap-2">
            <Input placeholder="Nome do sub-nicho" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="Ícone" value={newIcon} onChange={(e) => setNewIcon(e.target.value)} />
            <Button disabled={!newName.trim() || create.isPending} onClick={() => create.mutate()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-lg border divide-y">
            {isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
            ) : (subs as any[]).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhum sub-nicho cadastrado. É opcional — empresas podem ficar sem sub-nicho.</p>
            ) : (
              (subs as any[]).map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{s.icon ?? "•"}</span>
                    <span className="text-sm">{s.name}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
