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

type Sched = { weekday: number; start_time: string; end_time: string };

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];


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

  // Os vínculos e horários de cada funcionário são carregados sob demanda no diálogo de edição.


  const save = useMutation({
    mutationFn: async ({ v, serviceIds, schedules }: {
      v: Partial<S>; serviceIds: string[] | null; schedules: Sched[] | null;
    }) => {
      let staffId = edit?.id;
      if (edit) {
        // Atualiza SOMENTE os campos alterados (nunca sobrescreve com vazio/null)
        if (Object.keys(v).length) {
          const { error } = await supabase.from("staff").update(v).eq("id", edit.id);
          if (error) throw error;
        }
      } else {
        const { data: created, error } = await supabase.from("staff")
          .insert({ ...v, company_id: companyId } as any).select("id").single();
        if (error) throw error;
        staffId = created.id;
      }
      if (!staffId) return;

      // Sincroniza vínculos de serviços apenas quando houve alteração
      if (serviceIds) {
        const { data: currentRows, error: curErr } = await supabase
          .from("staff_services").select("service_id").eq("staff_id", staffId);
        if (curErr) throw curErr;
        const current = (currentRows ?? []).map((r) => r.service_id);
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
      }

      // Sincroniza jornada de trabalho apenas quando houve alteração
      if (schedules) {
        const { error: delErr } = await supabase.from("staff_schedules").delete().eq("staff_id", staffId);
        if (delErr) throw delErr;
        if (schedules.length) {
          const { error } = await supabase.from("staff_schedules")
            .insert(schedules.map((s) => ({ ...s, staff_id: staffId! })));
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success(edit ? "Funcionário atualizado" : "Funcionário criado");
      qc.invalidateQueries({ queryKey: ["staff", companyId] });
      qc.invalidateQueries({ queryKey: ["staff_services_links", companyId] });
      qc.invalidateQueries({ queryKey: ["staff_detail"] });
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
          {open && (
            <StaffDialog
              key={edit?.id ?? "new"}
              editId={edit?.id ?? null}
              services={services}
              onSave={(v, serviceIds, schedules) => save.mutate({ v, serviceIds, schedules })}
              loading={save.isPending}
            />
          )}
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
  editId, onSave, loading, services,
}: {
  editId: string | null;
  onSave: (v: Partial<S>, serviceIds: string[] | null, schedules: Sched[] | null) => void;
  loading: boolean;
  services: { id: string; name: string; active: boolean }[];
}) {
  // Busca sempre os dados atuais do funcionário pelo ID (evita formulário vazio/desatualizado)
  const { data: detail, isLoading } = useQuery({
    queryKey: ["staff_detail", editId],
    enabled: !!editId,
    staleTime: 0,
    queryFn: async () => {
      const [row, links, scheds] = await Promise.all([
        supabase.from("staff").select("*").eq("id", editId!).maybeSingle(),
        supabase.from("staff_services").select("service_id").eq("staff_id", editId!),
        supabase.from("staff_schedules").select("weekday,start_time,end_time").eq("staff_id", editId!).order("weekday"),
      ]);
      if (row.error) throw row.error;
      if (links.error) throw links.error;
      if (scheds.error) throw scheds.error;
      return {
        staff: row.data as S,
        serviceIds: (links.data ?? []).map((l) => l.service_id),
        schedules: ((scheds.data ?? []) as any[]).map((s) => ({
          weekday: s.weekday,
          start_time: String(s.start_time).slice(0, 5),
          end_time: String(s.end_time).slice(0, 5),
        })) as Sched[],
      };
    },
  });

  if (editId && (isLoading || !detail)) {
    return (
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Editar funcionário</DialogTitle></DialogHeader>
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando dados do funcionário…</p>
      </DialogContent>
    );
  }

  return (
    <StaffForm
      key={editId ?? "new"}
      original={detail?.staff ?? null}
      originalServiceIds={detail?.serviceIds ?? []}
      originalSchedules={detail?.schedules ?? []}
      services={services}
      onSave={onSave}
      loading={loading}
    />
  );
}

const EMPTY_FORM: Partial<S> = {
  name: "", phone: "", email: "", role_title: "",
  color: "#8b7355", active: true, commission_pct: 0, photo_url: null,
};

function StaffForm({
  original, originalServiceIds, originalSchedules, services, onSave, loading,
}: {
  original: S | null;
  originalServiceIds: string[];
  originalSchedules: Sched[];
  services: { id: string; name: string; active: boolean }[];
  onSave: (v: Partial<S>, serviceIds: string[] | null, schedules: Sched[] | null) => void;
  loading: boolean;
}) {
  const [f, setF] = useState<Partial<S>>(original ? { ...original } : { ...EMPTY_FORM });
  const [svcIds, setSvcIds] = useState<string[]>([...originalServiceIds]);
  const [scheds, setScheds] = useState<Sched[]>([...originalSchedules]);

  const toggleSvc = (id: string) =>
    setSvcIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const dayOf = (w: number) => scheds.find((s) => s.weekday === w);
  const toggleDay = (w: number) =>
    setScheds((prev) => prev.some((s) => s.weekday === w)
      ? prev.filter((s) => s.weekday !== w)
      : [...prev, { weekday: w, start_time: "09:00", end_time: "18:00" }].sort((a, b) => a.weekday - b.weekday));
  const setDay = (w: number, patch: Partial<Sched>) =>
    setScheds((prev) => prev.map((s) => (s.weekday === w ? { ...s, ...patch } : s)));

  const submit = () => {
    if (!original) {
      onSave(f, svcIds, scheds.length ? scheds : null);
      return;
    }
    // Diff: envia apenas os campos realmente alterados
    const patch: Partial<S> = {};
    (Object.keys(f) as (keyof S)[]).forEach((k) => {
      if (k === "id") return;
      const nv = f[k];
      const ov = original[k];
      const norm = (x: any) => (x === "" || x === undefined ? null : x);
      if (norm(nv) !== norm(ov)) (patch as any)[k] = nv === "" ? null : nv;
    });
    const svcChanged =
      svcIds.length !== originalServiceIds.length ||
      svcIds.some((id) => !originalServiceIds.includes(id));
    const schedKey = (list: Sched[]) =>
      JSON.stringify([...list].sort((a, b) => a.weekday - b.weekday));
    const schedChanged = schedKey(scheds) !== schedKey(originalSchedules);
    onSave(patch, svcChanged ? svcIds : null, schedChanged ? scheds : null);
  };

  return (
    <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{original ? "Editar funcionário" : "Novo funcionário"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Foto</Label>
          <ImageUpload value={f.photo_url} folder="staff" preset="avatar" onChange={(url) => setF({ ...f, photo_url: url })} />
        </div>
        <div><Label>Nome</Label>
          <Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Telefone / WhatsApp</Label>
            <Input value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><Label>E-mail</Label>
            <Input value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        </div>
        <div><Label>Cargo / Função</Label>
          <Input value={f.role_title ?? ""} onChange={(e) => setF({ ...f, role_title: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Comissão (%)</Label>
            <Input type="number" step="0.01" value={f.commission_pct ?? 0}
              onChange={(e) => setF({ ...f, commission_pct: parseFloat(e.target.value || "0") })} /></div>
          <div><Label>Cor da agenda</Label>
            <Input type="color" value={f.color ?? "#8b7355"} onChange={(e) => setF({ ...f, color: e.target.value })} /></div>
        </div>

        <div className="rounded-lg border p-3 space-y-2">
          <Label>Horário de trabalho</Label>
          <p className="text-xs text-muted-foreground">
            Marque os dias trabalhados. Se nenhum dia for marcado, vale o horário da empresa.
          </p>
          <div className="space-y-1">
            {WEEKDAYS.map((label, w) => {
              const d = dayOf(w);
              return (
                <div key={w} className="flex items-center gap-2 text-sm">
                  <label className="flex items-center gap-2 w-20 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4" checked={!!d} onChange={() => toggleDay(w)} />
                    <span>{label}</span>
                  </label>
                  <Input type="time" className="h-8" disabled={!d}
                    value={d?.start_time ?? ""} onChange={(e) => setDay(w, { start_time: e.target.value })} />
                  <span className="text-muted-foreground">às</span>
                  <Input type="time" className="h-8" disabled={!d}
                    value={d?.end_time ?? ""} onChange={(e) => setDay(w, { end_time: e.target.value })} />
                </div>
              );
            })}
          </div>
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
        <Button onClick={submit} disabled={loading || !f.name}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

