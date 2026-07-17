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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Users, Phone, Mail, MessageCircle, History } from "lucide-react";
import { dateBR, brl } from "@/lib/format";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ui/image-upload";

export const Route = createFileRoute("/_authenticated/app/customers")({
  component: Customers,
});

type C = {
  id: string; name: string; phone: string | null; whatsapp: string | null; email: string | null;
  birthdate: string | null; notes: string | null; tags: string[] | null; photo_url: string | null;
};

function Customers() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<C | null>(null);
  const [open, setOpen] = useState(false);
  const [historyOf, setHistoryOf] = useState<C | null>(null);

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
    (c.whatsapp ?? "").includes(q) ||
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
        <Input placeholder="Buscar por nome, telefone, WhatsApp ou e-mail…" className="pl-9"
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
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-11 w-11">
                      {c.photo_url && <AvatarImage src={c.photo_url} alt={c.name} />}
                      <AvatarFallback>{c.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                        {c.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{c.phone}</p>}
                        {c.whatsapp && <p className="flex items-center gap-1.5"><MessageCircle className="h-3 w-3" />{c.whatsapp}</p>}
                        {c.email && <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" />{c.email}</p>}
                        {c.birthdate && <p>🎂 {dateBR(c.birthdate)}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" title="Histórico" onClick={() => setHistoryOf(c)}>
                      <History className="h-4 w-4" />
                    </Button>
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

      <Dialog open={!!historyOf} onOpenChange={(o) => !o && setHistoryOf(null)}>
        {historyOf && <HistoryDialog customer={historyOf} />}
      </Dialog>
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
        <div>
          <Label>Foto</Label>
          <ImageUpload value={f.photo_url} folder="customers" onChange={(url) => setF({ ...f, photo_url: url })} />
        </div>
        <div><Label>Nome</Label>
          <Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Telefone</Label>
            <Input value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><Label>WhatsApp</Label>
            <Input value={f.whatsapp ?? ""} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>E-mail</Label>
            <Input type="email" value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><Label>Aniversário</Label>
            <Input type="date" value={f.birthdate ?? ""} onChange={(e) => setF({ ...f, birthdate: e.target.value })} /></div>
        </div>
        <div><Label>Observações</Label>
          <Textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(f)} disabled={loading || !f.name}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function HistoryDialog({ customer }: { customer: C }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["customer-history", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, starts_at, status, total_cents, discount_cents, staff:staff_id(name), appointment_services(services(name))")
        .eq("customer_id", customer.id)
        .order("starts_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {customer.photo_url && <AvatarImage src={customer.photo_url} alt="" />}
            <AvatarFallback>{customer.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          Histórico — {customer.name}
        </DialogTitle>
      </DialogHeader>
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando…</p>
      ) : !data.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum agendamento ainda.</p>
      ) : (
        <div className="space-y-2">
          {data.map((a: any) => (
            <div key={a.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {new Date(a.starts_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {(a.appointment_services ?? []).map((x: any) => x.services?.name).filter(Boolean).join(", ") || "—"}
                    {a.staff?.name ? ` · ${a.staff.name}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{brl(Math.max(0, (a.total_cents ?? 0) - (a.discount_cents ?? 0)) / 100)}</p>
                  <p className="text-xs text-muted-foreground capitalize">{a.status}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DialogContent>
  );
}
