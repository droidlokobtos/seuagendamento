import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, UserCog, Calendar } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ui/image-upload";

export const Route = createFileRoute("/_authenticated/app/staff")({
  component: Staff,
});

type S = {
  id: string; name: string; phone: string | null; email: string | null;
  role_title: string | null; color: string | null; commission_pct: number | null;
  photo_url: string | null; active: boolean;
};

function Staff() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const [edit, setEdit] = useState<S | null>(null);
  const [open, setOpen] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["staff", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*").eq("company_id", companyId).order("name");
      if (error) throw error;
      return (data ?? []) as S[];
    },
  });

  // Serviços da empresa + vínculos (quem atende o quê)
  const { data: services = [] } = useQuery({
    queryKey: ["staff_services_options", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id,name,active")
        .eq("company_id", companyId).order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; active: boolean }[];
    },
  });

  const { data: links = [] } = useQuery({
    queryKey: ["staff_services_links", companyId, data.map((s) => s.id).join(",")],
    queryFn: async () => {
      const ids = data.map((s) => s.id);
      if (!ids.length) return [];
      const { data: rows, error } = await supabase.from("staff_services").select("staff_id,service_id").in("staff_id", ids);
      if (error) throw error;
      return (rows ?? []) as { staff_id: string; service_id: string }[];
    },
    enabled: data.length > 0,
  });

  const save = useMutation({
    mutationFn: async ({ v, serviceIds }: { v: Partial<S>; serviceIds: string[] }) => {
      let staffId = edit?.id;
      if (edit) {
        const { error } = await supabase.from("staff").update(v).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { data: created, error } = await supabase.from("staff")
          .insert({ ...v, company_id: companyId } as any).select("id").single();
        if (error) throw error;
        staffId = created.id;
      }
      if (!staffId) return;
      // Sincroniza vínculos de serviços
      const current = links.filter((l) => l.staff_id === staffId).map((l) => l.service_id);
      const toAdd = serviceIds.filter((id) => !current.includes(id));
      const toRemove = current.filter((id) => !serviceIds.includes(id));
      if (toRemove.length) {
        const { error } = await supabase.from("staff_services").delete()
          .eq("staff_id", staffId).in("service_id", toRemove);
        if (error) throw error;
      }
      if (toAdd.length) {
        const { error } = await supabase.from("staff_services")
          .insert(toAdd.map((service_id) => ({ staff_id: staffId!, service_id })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(edit ? "Funcionário atualizado" : "Funcionário criado");
      qc.invalidateQueries({ queryKey: ["staff", companyId] });
      qc.invalidateQueries({ queryKey: ["staff_services_links", companyId] });
      setOpen(false); setEdit(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["staff", companyId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Funcionários</h1>
          <p className="text-sm text-muted-foreground">Profissionais que atendem na empresa.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEdit(null)}><Plus className="h-4 w-4 mr-2" /> Novo funcionário</Button>
          </DialogTrigger>
          <StaffDialog
            key={edit?.id ?? "new"}
            edit={edit}
            services={services}
            selectedServiceIds={edit ? links.filter((l) => l.staff_id === edit.id).map((l) => l.service_id) : []}
            onSave={(v, serviceIds) => save.mutate({ v, serviceIds })}
            loading={save.isPending}
          />
        </Dialog>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : !data.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <UserCog className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhum funcionário cadastrado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => (
            <Card key={s.id} className={!s.active ? "opacity-60" : ""}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-11 w-11" style={{ background: s.color ?? "#8b7355" }}>
                      {s.photo_url && <AvatarImage src={s.photo_url} alt={s.name} />}
                      <AvatarFallback className="text-white" style={{ background: s.color ?? "#8b7355" }}>
                        {s.name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.role_title ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => { setEdit(s); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(s.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
                  {s.phone && <p>📞 {s.phone}</p>}
                  {s.commission_pct != null && <p>Comissão: {s.commission_pct}%</p>}
                </div>
                <Button asChild variant="outline" size="sm" className="w-full mt-3">
                  <Link to="/app/agenda" search={{ staff: s.id } as any}>
                    <Calendar className="h-4 w-4 mr-2" /> Agenda própria
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StaffDialog({
  edit, onSave, loading, services, selectedServiceIds,
}: {
  edit: S | null;
  onSave: (v: Partial<S>, serviceIds: string[]) => void;
  loading: boolean;
  services: { id: string; name: string; active: boolean }[];
  selectedServiceIds: string[];
}) {
  const [f, setF] = useState<Partial<S>>(edit ?? { name: "", color: "#8b7355", active: true, commission_pct: 0 });
  const [svcIds, setSvcIds] = useState<string[]>(selectedServiceIds);
  const toggleSvc = (id: string) =>
    setSvcIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  return (
    <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{edit ? "Editar funcionário" : "Novo funcionário"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Foto</Label>
          <ImageUpload value={f.photo_url} folder="staff" preset="avatar" onChange={(url) => setF({ ...f, photo_url: url })} />
        </div>
        <div><Label>Nome</Label>
          <Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Telefone</Label>
            <Input value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><Label>E-mail</Label>
            <Input value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        </div>
        <div><Label>Cargo</Label>
          <Input value={f.role_title ?? ""} onChange={(e) => setF({ ...f, role_title: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Comissão (%)</Label>
            <Input type="number" step="0.01" value={f.commission_pct ?? 0}
              onChange={(e) => setF({ ...f, commission_pct: parseFloat(e.target.value || "0") })} /></div>
          <div><Label>Cor</Label>
            <Input type="color" value={f.color ?? "#8b7355"} onChange={(e) => setF({ ...f, color: e.target.value })} /></div>
        </div>
        <div className="rounded-lg border p-3 space-y-2">
          <Label>Serviços que este profissional atende</Label>
          <p className="text-xs text-muted-foreground">
            Usado no agendamento online: só aparece para os clientes nos serviços marcados.
          </p>
          {!services.length ? (
            <p className="text-xs text-muted-foreground">Cadastre serviços primeiro.</p>
          ) : (
            <div className="max-h-44 overflow-y-auto space-y-1">
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4" checked={svcIds.includes(s.id)} onChange={() => toggleSvc(s.id)} />
                  <span className={s.active ? "" : "text-muted-foreground line-through"}>{s.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <Label>Ativo</Label>
          <Switch checked={f.active ?? true} onCheckedChange={(v) => setF({ ...f, active: v })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(f, svcIds)} disabled={loading || !f.name}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}
