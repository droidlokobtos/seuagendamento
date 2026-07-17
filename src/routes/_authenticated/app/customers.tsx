import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Plus, Pencil, Trash2, Search, Users, Phone, Mail } from "lucide-react";
import { dateBR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/customers")({
  component: Customers,
});

type C = {
  id: string; name: string; phone: string | null; email: string | null;
  birthdate: string | null; notes: string | null; tags: string[] | null;
};

function Customers() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<C | null>(null);
  const [open, setOpen] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["customers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("company_id", companyId).order("name");
      if (error) throw error;
      return (data ?? []) as C[];
    },
  });

  const filtered = data.filter((c) =>
    !q ||
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    (c.phone ?? "").includes(q) ||
    (c.email ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  const save = useMutation({
    mutationFn: async (v: Partial<C>) => {
      if (edit) {
        const { error } = await supabase.from("customers").update(v).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({ ...v, company_id: companyId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(edit ? "Cliente atualizado" : "Cliente criado");
      qc.invalidateQueries({ queryKey: ["customers", companyId] });
      setOpen(false); setEdit(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["customers", companyId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Base de clientes da empresa.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEdit(null)}><Plus className="h-4 w-4 mr-2" /> Novo cliente</Button>
          </DialogTrigger>
          <CustomerDialog edit={edit} onSave={(v) => save.mutate(v)} loading={save.isPending} />
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, telefone ou e-mail…" className="pl-9"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {q ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {c.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{c.phone}</p>}
                      {c.email && <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" />{c.email}</p>}
                      {c.birthdate && <p>🎂 {dateBR(c.birthdate)}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEdit(c); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(c.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

function CustomerDialog({
  edit, onSave, loading,
}: { edit: C | null; onSave: (v: Partial<C>) => void; loading: boolean }) {
  const [f, setF] = useState<Partial<C>>(edit ?? { name: "" });
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>{edit ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Nome</Label>
          <Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Telefone</Label>
            <Input value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><Label>Aniversário</Label>
            <Input type="date" value={f.birthdate ?? ""} onChange={(e) => setF({ ...f, birthdate: e.target.value })} /></div>
        </div>
        <div><Label>E-mail</Label>
          <Input type="email" value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><Label>Observações</Label>
          <Textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(f)} disabled={loading || !f.name}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}
