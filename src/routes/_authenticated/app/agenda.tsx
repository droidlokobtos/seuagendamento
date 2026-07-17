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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, MessageCircle, Calendar as CalIcon } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/agenda")({
  component: Agenda,
});

const STATUS: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Agendado", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  confirmed: { label: "Confirmado", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  in_progress: { label: "Em atendimento", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  completed: { label: "Concluído", color: "bg-primary/15 text-primary border-primary/30" },
  cancelled: { label: "Cancelado", color: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
  no_show: { label: "Faltou", color: "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300 border-neutral-500/30" },
};

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Agenda() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const [day, setDay] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);

  const dayEnd = useMemo(() => { const d = new Date(day); d.setDate(d.getDate() + 1); return d; }, [day]);

  const { data: appts = [] } = useQuery({
    queryKey: ["appts", companyId, day.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id,starts_at,ends_at,status,total_cents,notes,customer_id,staff_id,customers(name,phone),staff(name,color)")
        .eq("company_id", companyId)
        .gte("starts_at", day.toISOString())
        .lt("starts_at", dayEnd.toISOString())
        .order("starts_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-lite", companyId],
    queryFn: async () => (await supabase.from("customers").select("id,name,phone").eq("company_id", companyId).order("name")).data ?? [],
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff-lite", companyId],
    queryFn: async () => (await supabase.from("staff").select("id,name,color").eq("company_id", companyId).eq("active", true).order("name")).data ?? [],
  });
  const { data: services = [] } = useQuery({
    queryKey: ["services-lite", companyId],
    queryFn: async () => (await supabase.from("services").select("id,name,duration_min,price_cents").eq("company_id", companyId).eq("active", true).order("name")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: any) => {
      const svc = services.find((s: any) => s.id === v.service_id);
      const dur = svc?.duration_min ?? 30;
      const price = svc?.price_cents ?? 0;
      const starts = new Date(v.starts_at);
      const ends = new Date(starts.getTime() + dur * 60_000);
      const payload = {
        company_id: companyId,
        customer_id: v.customer_id || null,
        staff_id: v.staff_id || null,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        status: v.status,
        total_cents: price,
        notes: v.notes || null,
      };
      if (edit) {
        const { error } = await supabase.from("appointments").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { data: appt, error } = await supabase.from("appointments").insert(payload).select("id").single();
        if (error) throw error;
        if (v.service_id) {
          await supabase.from("appointment_services").insert({
            appointment_id: appt!.id, service_id: v.service_id, price_cents: price, duration_min: dur,
          });
        }
      }
    },
    onSuccess: () => {
      toast.success(edit ? "Agendamento atualizado" : "Agendamento criado");
      qc.invalidateQueries({ queryKey: ["appts", companyId] });
      setOpen(false); setEdit(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["appts", companyId] }); },
  });

  const shiftDay = (n: number) => { const d = new Date(day); d.setDate(d.getDate() + n); setDay(d); };
  const isToday = day.toDateString() === new Date().toDateString();

  const sendWhatsApp = (a: any) => {
    if (!a.customers?.phone) { toast.error("Cliente sem telefone"); return; }
    const dt = new Date(a.starts_at);
    const msg = `Olá ${a.customers.name}! Confirmando seu agendamento em *${activeCompany?.name}* para ${dt.toLocaleDateString("pt-BR")} às ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Podemos confirmar?`;
    const phone = a.customers.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Agenda</h1>
          <p className="text-sm text-muted-foreground">Agendamentos do dia.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEdit(null)}><Plus className="h-4 w-4 mr-2" /> Novo agendamento</Button>
          </DialogTrigger>
          <ApptDialog
            edit={edit}
            defaultDate={day}
            customers={customers as any}
            staff={staff as any}
            services={services as any}
            onSave={(v) => save.mutate(v)}
            loading={save.isPending}
          />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <Button variant="outline" size="icon" onClick={() => shiftDay(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-center">
            <p className="text-sm font-medium">
              {day.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </p>
            {!isToday && (
              <button className="text-xs text-primary underline" onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setDay(d); }}>
                voltar para hoje
              </button>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={() => shiftDay(1)}><ChevronRight className="h-4 w-4" /></Button>
        </CardContent>
      </Card>

      {!appts.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CalIcon className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhum agendamento neste dia.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {appts.map((a: any) => {
            const st = STATUS[a.status] ?? STATUS.scheduled;
            return (
              <Card key={a.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="text-center shrink-0 w-16">
                    <p className="text-lg font-semibold">
                      {new Date(a.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      até {new Date(a.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{a.customers?.name ?? "Sem cliente"}</p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {a.staff && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="h-2 w-2 rounded-full" style={{ background: a.staff.color ?? "#8b7355" }} />
                          {a.staff.name}
                        </span>
                      )}
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${st.color}`}>{st.label}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{brl((a.total_cents ?? 0) / 100)}</p>
                    <div className="mt-1 flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" title="WhatsApp" onClick={() => sendWhatsApp(a)}>
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEdit(a); setOpen(true); }}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Cancelar/remover?")) del.mutate(a.id); }}>
                        Remover
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ApptDialog({
  edit, defaultDate, customers, staff, services, onSave, loading,
}: {
  edit: any | null;
  defaultDate: Date;
  customers: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  services: { id: string; name: string; duration_min: number; price_cents: number }[];
  onSave: (v: any) => void;
  loading: boolean;
}) {
  const initial = edit
    ? {
        customer_id: edit.customer_id ?? "",
        staff_id: edit.staff_id ?? "",
        service_id: "",
        starts_at: toLocalInput(new Date(edit.starts_at)),
        status: edit.status,
        notes: edit.notes ?? "",
      }
    : {
        customer_id: "",
        staff_id: "",
        service_id: "",
        starts_at: toLocalInput(new Date(defaultDate.getTime() + 9 * 60 * 60_000)),
        status: "scheduled",
        notes: "",
      };
  const [f, setF] = useState<any>(initial);

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>{edit ? "Editar agendamento" : "Novo agendamento"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Cliente</Label>
          <Select value={f.customer_id} onValueChange={(v) => setF({ ...f, customer_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Funcionário</Label>
          <Select value={f.staff_id} onValueChange={(v) => setF({ ...f, staff_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
            <SelectContent>
              {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {!edit && (
          <div>
            <Label>Serviço</Label>
            <Select value={f.service_id} onValueChange={(v) => setF({ ...f, service_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {s.duration_min} min · {brl(s.price_cents / 100)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label>Início</Label>
          <Input type="datetime-local" value={f.starts_at}
            onChange={(e) => setF({ ...f, starts_at: e.target.value })} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Observações</Label>
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(f)} disabled={loading}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}
