import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Tag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/niches")({
  component: Niches,
});

function Niches() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["niches-admin"],
    queryFn: async () => (await supabase.from("niches").select("*").order("name")).data ?? [],
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
          <p className="text-sm text-muted-foreground mt-1">Segmentos disponíveis para novas empresas.</p>
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
            <Card key={n.id}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent-foreground text-lg">
                    {n.icon ?? <Tag className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{n.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(n.suggested_services as any[])?.length ?? 0} serviços sugeridos
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
