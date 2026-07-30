import { SmartProfileSummary } from "@/components/app/SmartProfile";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, MessageCircle, Calendar as CalIcon, Check, CheckCheck, X, Play } from "lucide-react";
import { computeFinance, PAYMENT_STATUS_META, type AppointmentPaymentStatus } from "@/lib/finance";
import { brl } from "@/lib/format";
import { APPOINTMENT_STATUS, FREED_STATUSES } from "@/lib/appointment-status";
import { toast } from "sonner";
import { WhatsAppShareDialog } from "@/components/app/WhatsAppShareDialog";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";

const searchSchema = z.object({
  staff: z.string().optional(),
  view: z.enum(["day", "week", "month"]).optional(),
});

export const Route = createFileRoute("/_authenticated/app/agenda")({
  validateSearch: zodValidator(searchSchema),
  component: Agenda,
});

const STATUS = APPOINTMENT_STATUS;

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfWeek(d: Date) { const x = startOfDay(d); const dow = x.getDay(); x.setDate(x.getDate() - dow); return x; }
function startOfMonth(d: Date) { const x = startOfDay(d); x.setDate(1); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtTime(d: Date | string) { return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
function fmtDate(d: Date) { return d.toLocaleDateString("pt-BR"); }

function Agenda() {
  const qc = useQueryClient();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const bufferMin = (activeCompany as any)?.buffer_min ?? 0;
  const view = search.view ?? "day";
  const staffFilter = search.staff ?? "";

  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [waMsg, setWaMsg] = useState<{ open: boolean; message: string; phone: string; title: string }>({
    open: false, message: "", phone: "", title: "",
  });

  const range = useMemo(() => {
    if (view === "day") return { from: anchor, to: addDays(anchor, 1) };
    if (view === "week") { const s = startOfWeek(anchor); return { from: s, to: addDays(s, 7) }; }
    const s = startOfMonth(anchor);
    const e = new Date(s); e.setMonth(e.getMonth() + 1);
    return { from: s, to: e };
  }, [anchor, view]);

  const { data: appts = [] } = useQuery({
    queryKey: ["appts", companyId, range.from.toISOString(), range.to.toISOString(), staffFilter],
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("id,starts_at,ends_at,status,total_cents,discount_cents,surcharge_cents,paid_cents,deposit_required_cents,payment_status,notes,customer_id,staff_id,customers(name,phone,whatsapp),staff(name,color),appointment_services(services(name))")
        .eq("company_id", companyId)
        .gte("starts_at", range.from.toISOString())
        .lt("starts_at", range.to.toISOString())
        .order("starts_at");
      if (staffFilter) q = q.eq("staff_id", staffFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ["blocks", companyId, range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_blocks")
        .select("id,starts_at,ends_at,reason,staff_id")
        .eq("company_id", companyId)
        .lt("starts_at", range.to.toISOString())
        .gt("ends_at", range.from.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: hours = [] } = useQuery({
    queryKey: ["hours", companyId],
    queryFn: async () => (await supabase.from("company_hours").select("*").eq("company_id", companyId)).data ?? [],
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-lite", companyId],
    queryFn: async () => (await supabase.from("customers").select("id,name,phone,whatsapp").eq("company_id", companyId).order("name")).data ?? [],
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff-lite", companyId],
    queryFn: async () => {
      // `staff` não possui coluna sort_order — ordenar por ela quebrava a
      // consulta e a lista de profissionais vinha vazia.
      const { data, error } = await supabase
        .from("staff")
        .select("id,name,color")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("name");
      if (error) {
        console.error("[agenda] falha ao carregar profissionais:", error);
        throw error;
      }
      return data ?? [];
    },
  });
  const { data: services = [] } = useQuery({
    queryKey: ["services-lite", companyId],
    queryFn: async () => (await supabase.from("services").select("id,name,duration_min,price_cents").eq("company_id", companyId).eq("active", true).order("sort_order", { ascending: true }).order("name")).data ?? [],
  });

  const activeStaffName = useMemo(
    () => (staffFilter ? (staff as any[]).find((s) => s.id === staffFilter)?.name : null),
    [staff, staffFilter],
  );

  const validate = (starts: Date, ends: Date, staff_id: string | null, ignoreId?: string) => {
    // Company hours
    const h = (hours as any[]).find((x) => x.weekday === starts.getDay());
    if (h) {
      if (h.closed) return "A empresa está fechada nesse dia.";
      const [sh, sm] = h.start_time.split(":").map(Number);
      const [eh, em] = h.end_time.split(":").map(Number);
      const minsStart = starts.getHours() * 60 + starts.getMinutes();
      const minsEnd = ends.getHours() * 60 + ends.getMinutes();
      if (minsStart < sh * 60 + sm || minsEnd > eh * 60 + em) return "Fora do horário de funcionamento.";
    }
    // Blocks
    for (const b of blocks as any[]) {
      if (b.staff_id && b.staff_id !== staff_id) continue;
      const bs = new Date(b.starts_at).getTime();
      const be = new Date(b.ends_at).getTime();
      if (starts.getTime() < be && ends.getTime() > bs) return `Horário bloqueado${b.reason ? ` (${b.reason})` : ""}.`;
    }
    // Conflicts + buffer
    const buf = bufferMin * 60_000;
    for (const a of appts as any[]) {
      if (ignoreId && a.id === ignoreId) continue;
      if (FREED_STATUSES.includes(a.status)) continue;
      if (staff_id && a.staff_id && a.staff_id !== staff_id) continue;
      const as = new Date(a.starts_at).getTime() - buf;
      const ae = new Date(a.ends_at).getTime() + buf;
      if (starts.getTime() < ae && ends.getTime() > as) {
        return `Conflito com agendamento às ${fmtTime(a.starts_at)}${bufferMin ? ` (intervalo ${bufferMin} min)` : ""}.`;
      }
    }
    return null;
  };

  const save = useMutation({
    mutationFn: async (v: any) => {
      const svc = (services as any[]).find((s) => s.id === v.service_id);
      const dur = svc?.duration_min ?? (edit ? Math.round((new Date(edit.ends_at).getTime() - new Date(edit.starts_at).getTime()) / 60000) : 30);
      const price = svc?.price_cents ?? edit?.total_cents ?? 0;
      const starts = new Date(v.starts_at);
      const ends = new Date(starts.getTime() + dur * 60_000);
      const err = validate(starts, ends, v.staff_id || null, edit?.id);
      if (err) throw new Error(err);
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
        // Mantém os serviços do agendamento em sincronia com o serviço escolhido
        if (v.service_id) {
          await supabase.from("appointment_services").delete().eq("appointment_id", edit.id);
          await supabase.from("appointment_services").insert({
            appointment_id: edit.id, service_id: v.service_id, price_cents: price, duration_min: dur,
          });
        }
        return { id: edit.id, isNew: false, ...payload };
      }
      const { data: appt, error } = await supabase.from("appointments").insert(payload).select("id").single();
      if (error) throw error;
      if (v.service_id) {
        await supabase.from("appointment_services").insert({
          appointment_id: appt!.id, service_id: v.service_id, price_cents: price, duration_min: dur,
        });
      }
      return { id: appt!.id, isNew: true, ...payload, service_name: svc?.name };
    },
    onSuccess: (result: any) => {
      toast.success(edit ? "Agendamento atualizado" : "Agendamento criado");
      qc.invalidateQueries({ queryKey: ["appts", companyId] });
      setOpen(false); setEdit(null);
      if (result?.isNew) {
        // Offer WhatsApp confirmation using the "new appointment" template
        const cust = (customers as any[]).find((c) => c.id === result.customer_id);
        const st = (staff as any[]).find((s) => s.id === result.staff_id);
        const dt = new Date(result.starts_at);
        const msg =
          `📅 Novo agendamento!\n\n` +
          `Cliente: ${cust?.name ?? "—"}\n` +
          `Serviço: ${result.service_name ?? "—"}\n` +
          `Profissional: ${st?.name ?? "—"}\n` +
          `Data: ${fmtDate(dt)}\n` +
          `Horário: ${fmtTime(dt)}\n\n` +
          `✅ Confirmado`;
        setWaMsg({
          open: true,
          title: "Novo agendamento — enviar por WhatsApp",
          message: msg,
          phone: cust?.whatsapp || cust?.phone || "",
        });
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Status: ${STATUS[v.status]?.label ?? v.status}`);
      qc.invalidateQueries({ queryKey: ["appts", companyId] });
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

  const shift = (n: number) => {
    const d = new Date(anchor);
    if (view === "day") d.setDate(d.getDate() + n);
    else if (view === "week") d.setDate(d.getDate() + n * 7);
    else d.setMonth(d.getMonth() + n);
    setAnchor(d);
  };

  const openNew = (at?: Date) => {
    setEdit(at ? { starts_at: at.toISOString() } : null);
    setOpen(true);
  };

  const sendConfirm = (a: any) => {
    const dt = new Date(a.starts_at);
    const svcName = (a.appointment_services ?? []).map((x: any) => x.services?.name).filter(Boolean).join(", ") || "—";
    const msg =
      `📅 Confirmação de agendamento\n\n` +
      `Cliente: ${a.customers?.name ?? "—"}\n` +
      `Serviço: ${svcName}\n` +
      `Profissional: ${a.staff?.name ?? "—"}\n` +
      `Data: ${fmtDate(dt)}\n` +
      `Horário: ${fmtTime(dt)}\n\n` +
      `Podemos confirmar? ✅`;
    setWaMsg({ open: true, title: "Confirmação — WhatsApp", message: msg, phone: a.customers?.whatsapp || a.customers?.phone || "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            {activeStaffName ? `Agenda de ${activeStaffName}` : "Agendamentos"}{bufferMin ? ` · intervalo padrão ${bufferMin} min` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={view} onValueChange={(v) => navigate({ search: (p: any) => ({ ...p, view: v as any }) })}>
            <TabsList>
              <TabsTrigger value="day">Dia</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={staffFilter || "all"} onValueChange={(v) => navigate({ search: (p: any) => ({ ...p, staff: v === "all" ? undefined : v }) })}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos profissionais</SelectItem>
              {(staff as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => openNew()}><Plus className="h-4 w-4 mr-2" /> Novo</Button>
            </DialogTrigger>
            {open && (
              <ApptDialog
                key={edit?.id ?? "new"}
                edit={edit && edit.id ? edit : null}
                seedDate={edit && !edit.id ? new Date(edit.starts_at) : anchor}
                customers={customers as any}
                staff={staff as any}
                services={services as any}
                defaultStaff={staffFilter || ""}
                onSave={(v) => save.mutate(v)}
                loading={save.isPending}
              />
            )}

          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <Button variant="outline" size="icon" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-center">
            <p className="text-sm font-medium">
              {view === "day" && anchor.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              {view === "week" && `${fmtDate(startOfWeek(anchor))} — ${fmtDate(addDays(startOfWeek(anchor), 6))}`}
              {view === "month" && anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </p>
            <button className="text-xs text-primary underline" onClick={() => setAnchor(startOfDay(new Date()))}>hoje</button>
          </div>
          <Button variant="outline" size="icon" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
        </CardContent>
      </Card>

      {view === "day" && (
        <DayView
          appts={appts as any[]}
          blocks={blocks as any[]}
          onOpen={(a) => { setEdit(a); setOpen(true); }}
          onNewAt={openNew}
          onConfirmWa={sendConfirm}
          onSetStatus={(id, status) => setStatus.mutate({ id, status })}
          onDelete={(id) => { if (confirm("Cancelar/remover?")) del.mutate(id); }}
        />
      )}

      {view === "week" && (
        <WeekView
          weekStart={startOfWeek(anchor)}
          appts={appts as any[]}
          blocks={blocks as any[]}
          onNewAt={openNew}
          onOpen={(a) => { setEdit(a); setOpen(true); }}
        />
      )}

      {view === "month" && (
        <MonthView
          monthStart={startOfMonth(anchor)}
          appts={appts as any[]}
          onDayClick={(d) => { setAnchor(d); navigate({ search: (p: any) => ({ ...p, view: "day" }) }); }}
        />
      )}

      <WhatsAppShareDialog
        open={waMsg.open}
        onOpenChange={(v) => setWaMsg((s) => ({ ...s, open: v }))}
        title={waMsg.title}
        message={waMsg.message}
        phone={waMsg.phone}
      />
    </div>
  );
}

/* ---------- Day view ---------- */
function DayView({
  appts, blocks, onOpen, onNewAt, onConfirmWa, onSetStatus, onDelete,
}: {
  appts: any[]; blocks: any[];
  onOpen: (a: any) => void;
  onNewAt: (d: Date) => void;
  onConfirmWa: (a: any) => void;
  onSetStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!appts.length && !blocks.length) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <CalIcon className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Nenhum agendamento neste dia.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {blocks.map((b) => (
        <Card key={`b-${b.id}`} className="border-dashed">
          <CardContent className="p-3 text-sm text-muted-foreground flex items-center gap-3">
            <span className="font-medium">{fmtTime(b.starts_at)} — {fmtTime(b.ends_at)}</span>
            <span>🚫 Bloqueado{b.reason ? ` · ${b.reason}` : ""}</span>
          </CardContent>
        </Card>
      ))}
      {appts.map((a) => {
        const st = STATUS[a.status] ?? STATUS.scheduled;
        const svc = (a.appointment_services ?? []).map((x: any) => x.services?.name).filter(Boolean).join(", ");
        return (
          <Card key={a.id}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="text-center shrink-0 w-16">
                <p className="text-lg font-semibold">{fmtTime(a.starts_at)}</p>
                <p className="text-[10px] text-muted-foreground">até {fmtTime(a.ends_at)}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{a.customers?.name ?? "Sem cliente"}</p>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {svc && <span className="text-xs text-muted-foreground truncate">{svc}</span>}
                  {a.staff && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ background: a.staff.color ?? "#8b7355" }} />
                      {a.staff.name}
                    </span>
                  )}
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${st.color}`}>{st.label}</span>
                  {(() => {
                    const meta = PAYMENT_STATUS_META[(a.payment_status ?? "pending") as AppointmentPaymentStatus];
                    return meta ? (
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full ${meta.className}`}>{meta.label}</span>
                    ) : null;
                  })()}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold">{brl((a.total_cents ?? 0) / 100)}</p>
                {(() => {
                  const f = computeFinance({
                    subtotalCents: a.total_cents, discountCents: a.discount_cents,
                    surchargeCents: a.surcharge_cents, paidCents: a.paid_cents,
                    depositRequiredCents: a.deposit_required_cents,
                  });
                  if (!f.paidCents && !f.depositRequiredCents) return null;
                  return (
                    <p className="text-[10px] text-muted-foreground">
                      Pago {brl(f.paidCents / 100)} · Saldo {brl(f.balanceCents / 100)}
                    </p>
                  );
                })()}
                <div className="mt-1 flex gap-1 justify-end flex-wrap">
                  <Button size="icon" variant="ghost" title="Confirmar por WhatsApp" onClick={() => onConfirmWa(a)}>
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  {a.status === "scheduled" && (
                    <Button size="icon" variant="ghost" title="Confirmar" onClick={() => onSetStatus(a.id, "confirmed")}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  {(a.status === "scheduled" || a.status === "confirmed") && (
                    <Button size="icon" variant="ghost" title="Iniciar" onClick={() => onSetStatus(a.id, "in_progress")}>
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  {a.status !== "completed" && a.status !== "cancelled" && (
                    <Button size="icon" variant="ghost" title="Finalizar" onClick={() => onSetStatus(a.id, "completed")}>
                      <CheckCheck className="h-4 w-4" />
                    </Button>
                  )}
                  {a.status !== "cancelled" && (
                    <Button size="icon" variant="ghost" title="Cancelar" onClick={() => onSetStatus(a.id, "cancelled")}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onOpen(a)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(a.id)}>Remover</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      <div className="text-center">
        <Button variant="outline" onClick={() => { const d = new Date(); onNewAt(d); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo neste dia
        </Button>
      </div>
    </div>
  );
}

/* ---------- Week view ---------- */
function WeekView({
  weekStart, appts, blocks, onNewAt, onOpen,
}: {
  weekStart: Date; appts: any[]; blocks: any[];
  onNewAt: (d: Date) => void; onOpen: (a: any) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
      {days.map((d) => {
        const list = appts.filter((a) => new Date(a.starts_at).toDateString() === d.toDateString());
        const blks = blocks.filter((b) => new Date(b.starts_at).toDateString() === d.toDateString());
        const isToday = d.toDateString() === new Date().toDateString();
        return (
          <Card key={d.toISOString()} className={isToday ? "border-primary" : ""}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase text-muted-foreground">
                  {d.toLocaleDateString("pt-BR", { weekday: "short" })}
                </p>
                <p className="text-sm font-semibold">{d.getDate()}</p>
              </div>
              <div className="mt-2 space-y-1">
                {blks.map((b) => (
                  <div key={b.id} className="text-[11px] px-2 py-1 rounded bg-muted text-muted-foreground">
                    🚫 {fmtTime(b.starts_at)}–{fmtTime(b.ends_at)}
                  </div>
                ))}
                {list.length === 0 && !blks.length && (
                  <p className="text-[11px] text-muted-foreground italic">Livre</p>
                )}
                {list.map((a) => {
                  const st = STATUS[a.status] ?? STATUS.scheduled;
                  return (
                    <button key={a.id} onClick={() => onOpen(a)}
                      className={`w-full text-left text-[11px] px-2 py-1 rounded border ${st.color}`}>
                      <span className="font-medium">{fmtTime(a.starts_at)}</span> · {a.customers?.name ?? "—"}
                    </button>
                  );
                })}
                <Button size="sm" variant="ghost" className="w-full h-7 text-xs" onClick={() => onNewAt(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9))}>
                  <Plus className="h-3 w-3 mr-1" /> Novo
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- Month view ---------- */
function MonthView({
  monthStart, appts, onDayClick,
}: { monthStart: Date; appts: any[]; onDayClick: (d: Date) => void }) {
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const monthIdx = monthStart.getMonth();
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1 text-center text-[11px] uppercase text-muted-foreground">
        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((w) => <div key={w}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const dayList = appts.filter((a) => new Date(a.starts_at).toDateString() === d.toDateString());
          const isCurMonth = d.getMonth() === monthIdx;
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <button key={d.toISOString()} onClick={() => onDayClick(d)}
              className={`min-h-20 rounded-md border p-1.5 text-left hover:bg-accent transition ${!isCurMonth ? "opacity-40" : ""} ${isToday ? "border-primary" : ""}`}>
              <div className="text-xs font-medium">{d.getDate()}</div>
              <div className="mt-1 space-y-0.5">
                {dayList.slice(0, 3).map((a) => (
                  <div key={a.id} className="truncate text-[10px] px-1 rounded bg-primary/10 text-primary">
                    {fmtTime(a.starts_at)} {a.customers?.name ?? ""}
                  </div>
                ))}
                {dayList.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayList.length - 3}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Dialog ---------- */
function ApptDialog({
  edit, seedDate, customers, staff, services, defaultStaff, onSave, loading,
}: {
  edit: any | null;
  seedDate: Date;
  customers: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  services: { id: string; name: string; duration_min: number; price_cents: number }[];
  defaultStaff: string;
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
        staff_id: defaultStaff,
        service_id: "",
        starts_at: toLocalInput(new Date(seedDate.getFullYear(), seedDate.getMonth(), seedDate.getDate(), 9)),
        status: "scheduled",
        notes: "",
      };
  const [f, setF] = useState<any>(initial);

  return (
    <DialogContent
      className="sm:max-w-md max-h-[85vh] overflow-y-auto"
      // O formulário não pode fechar sozinho: só sai por Cancelar / X / Esc.
      onInteractOutside={(e) => e.preventDefault()}
      onPointerDownOutside={(e) => e.preventDefault()}
    >
      <DialogHeader><DialogTitle>{edit ? "Editar agendamento" : "Novo agendamento"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Cliente</Label>
          <Select value={f.customer_id} onValueChange={(v) => setF({ ...f, customer_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
            <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {f.customer_id && (
          <SafeBoundary label="as observações do cliente">
            <SmartProfileSummary customerId={f.customer_id} selectedStaffId={f.staff_id || null} />
          </SafeBoundary>
        )}

        <div>
          <Label>Funcionário</Label>
          {staff.length === 0 ? (
            <p className="rounded-md border border-dashed p-2 text-sm text-muted-foreground">
              Nenhum profissional cadastrado.
            </p>
          ) : (
            <Select value={f.staff_id} onValueChange={(v) => setF({ ...f, staff_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
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
          <Input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
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
