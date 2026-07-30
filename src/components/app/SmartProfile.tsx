import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sparkles, Pin, PinOff, Plus, Trash2, Search, User, Scissors, Package,
  Bell, CalendarHeart, MessageCircle, Save, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { brl, dateBR } from "@/lib/format";
import {
  COMMUNICATION_PREFS, DATE_KINDS, NOTE_KINDS, NOTE_SUGGESTIONS, RESTRICTIONS,
  useSmartDates, useSmartNotes, useSmartProfile, useSmartStats, type SmartNote,
} from "@/lib/smart-profile";

/* =========================================================
   Painel completo — aba "Perfil Inteligente"
   ========================================================= */
export function SmartProfilePanel({
  companyId, customerId,
}: { companyId: string; customerId: string }) {
  const qc = useQueryClient();
  const { data: profile } = useSmartProfile(companyId, customerId);
  const { data: notes = [] } = useSmartNotes(customerId);
  const { data: dates = [] } = useSmartDates(customerId);
  const { data: statsData } = useSmartStats(customerId);
  const stats = statsData?.stats;

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-lite", companyId],
    queryFn: async () =>
      (await supabase.from("staff").select("id,name").eq("company_id", companyId).eq("active", true).order("name")).data ?? [],
  });

  const [noteQ, setNoteQ] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newNoteKind, setNewNoteKind] = useState("preference");
  const [general, setGeneral] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["smart-profile", customerId] });
    qc.invalidateQueries({ queryKey: ["smart-notes", customerId] });
    qc.invalidateQueries({ queryKey: ["smart-dates", customerId] });
    qc.invalidateQueries({ queryKey: ["smart-history", customerId] });
  };

  const upsertProfile = useMutation({
    mutationFn: async (v: Record<string, any>) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("customer_profiles").upsert(
        {
          customer_id: customerId,
          company_id: companyId,
          communication_pref: profile?.communication_pref ?? "whatsapp",
          restrictions: profile?.restrictions ?? [],
          preferred_staff_id: profile?.preferred_staff_id ?? null,
          general_notes: profile?.general_notes ?? null,
          ...v,
          updated_by: userRes.user?.id ?? null,
        },
        { onConflict: "customer_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Perfil atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const addNote = useMutation({
    mutationFn: async (v: { content: string; kind: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("customer_notes").insert({
        company_id: companyId, customer_id: customerId,
        kind: v.kind, content: v.content, created_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNewNote(""); invalidate(); toast.success("Observação adicionada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateNote = useMutation({
    mutationFn: async (v: { id: string; patch: Partial<SmartNote> }) => {
      const { error } = await supabase.from("customer_notes").update(v.patch as any).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const delNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customer_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Observação removida (registrada no histórico)"); },
    onError: (e: any) => toast.error(e.message),
  });

  const addDate = useMutation({
    mutationFn: async (v: { kind: string; title: string; date: string; notes: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("customer_dates").insert({
        company_id: companyId, customer_id: customerId,
        kind: v.kind, title: v.title || null, date: v.date, notes: v.notes || null,
        created_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Data registrada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const delDate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customer_dates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const filteredNotes = useMemo(() => {
    const s = noteQ.trim().toLowerCase();
    if (!s) return notes;
    return notes.filter((n) => n.content.toLowerCase().includes(s));
  }, [notes, noteQ]);

  const restrictions = profile?.restrictions ?? [];
  const toggleRestriction = (key: string) => {
    const next = restrictions.includes(key) ? restrictions.filter((r) => r !== key) : [...restrictions, key];
    upsertProfile.mutate({ restrictions: next });
  };

  const [dateForm, setDateForm] = useState({ kind: "commemorative", title: "", date: "", notes: "" });

  return (
    <div className="space-y-4">
      {/* Resumo automático */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Informações automáticas</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Primeira visita" value={stats?.firstVisit ? dateBR(stats.firstVisit) : "—"} />
            <Stat label="Última visita" value={stats?.lastVisit ? dateBR(stats.lastVisit) : "—"} />
            <Stat label="Total de visitas" value={String(stats?.totalVisits ?? 0)} />
            <Stat label="Total gasto" value={brl((stats?.totalSpentCents ?? 0) / 100)} />
            <Stat label="Ticket médio" value={brl((stats?.avgTicketCents ?? 0) / 100)} />
            <Stat label="Retorno médio" value={stats?.avgReturnDays ? `${stats.avgReturnDays} dias` : "—"} />
            <Stat label="Último serviço" value={stats?.lastService ?? "—"} />
            <Stat label="Preferência de contato" value={COMMUNICATION_PREFS[profile?.communication_pref ?? "whatsapp"]} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Profissional preferido */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <CardTitleRow icon={<User className="h-4 w-4" />} title="Profissional preferido" />
            {stats?.favoriteStaff ? (
              <div className="rounded-lg border p-3">
                <p className="font-medium">👤 {stats.favoriteStaff.name}</p>
                <p className="text-xs text-muted-foreground">{stats.favoriteStaff.count} atendimentos</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem histórico suficiente.</p>
            )}
            <div>
              <Label className="text-xs">Definir manualmente</Label>
              <Select
                value={profile?.preferred_staff_id ?? "auto"}
                onValueChange={(v) => upsertProfile.mutate({ preferred_staff_id: v === "auto" ? null : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático (mais escolhido)</SelectItem>
                  {(staff as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Serviço favorito + produtos */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <CardTitleRow icon={<Scissors className="h-4 w-4" />} title="Serviço favorito" />
            {stats?.favoriteService ? (
              <div className="rounded-lg border p-3">
                <p className="font-medium">{stats.favoriteService.name}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.favoriteService.count}x · última em {stats.favoriteService.last ? dateBR(stats.favoriteService.last) : "—"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem histórico suficiente.</p>
            )}
            <CardTitleRow icon={<Package className="h-4 w-4" />} title="Produtos preferidos" />
            {stats?.topProducts.length ? (
              <div className="flex flex-wrap gap-1.5">
                {stats.topProducts.map((p) => (
                  <Badge key={p.name} variant="secondary" className="text-[11px]">{p.name} · {p.qty}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum produto registrado.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Restrições + comunicação */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <CardTitleRow icon={<Bell className="h-4 w-4" />} title="Restrições e comunicação" />
          <div className="flex flex-wrap gap-3">
            {RESTRICTIONS.map((r) => (
              <label key={r.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={restrictions.includes(r.key)} onCheckedChange={() => toggleRestriction(r.key)} />
                <span>{r.emoji} {r.label}</span>
              </label>
            ))}
          </div>
          <div className="max-w-xs">
            <Label className="text-xs flex items-center gap-1.5"><MessageCircle className="h-3 w-3" /> Preferência de comunicação</Label>
            <Select
              value={profile?.communication_pref ?? "whatsapp"}
              onValueChange={(v) => upsertProfile.mutate({ communication_pref: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(COMMUNICATION_PREFS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Observações */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <CardTitleRow icon={<Sparkles className="h-4 w-4" />} title="Preferências e observações" />

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder='Pesquisar nas observações (ex.: "alergia")'
              value={noteQ} onChange={(e) => setNoteQ(e.target.value)} />
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_170px_auto]">
            <Input placeholder="Nova observação…" value={newNote} onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newNote.trim()) addNote.mutate({ content: newNote.trim(), kind: newNoteKind }); }} />
            <Select value={newNoteKind} onValueChange={setNewNoteKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(NOTE_KINDS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button disabled={!newNote.trim() || addNote.isPending}
              onClick={() => addNote.mutate({ content: newNote.trim(), kind: newNoteKind })}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {NOTE_SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => setNewNote(s)}
                className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted">
                + {s}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {!filteredNotes.length && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {noteQ ? "Nenhuma observação encontrada." : "Nenhuma observação cadastrada."}
              </p>
            )}
            {filteredNotes.map((n) => (
              <div key={n.id} className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${n.pinned ? "border-primary/40 bg-primary/5" : ""}`}>
                <div className="min-w-0">
                  <p className="text-sm">{n.pinned && "📌 "}{n.content}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {NOTE_KINDS[n.kind] ?? n.kind} · {dateBR(n.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" title={n.pinned ? "Desafixar" : "Fixar como importante"}
                    onClick={() => updateNote.mutate({ id: n.id, patch: { pinned: !n.pinned } })}>
                    {n.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover observação?")) delNote.mutate(n.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Observações gerais (campo livre) */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <CardTitleRow icon={<Sparkles className="h-4 w-4" />} title="Observações gerais" />
          <Textarea
            rows={4}
            placeholder="Ex.: alergia a determinados produtos, sensibilidade no couro cabeludo, prefere tesoura em vez de máquina…"
            value={general ?? profile?.general_notes ?? ""}
            onChange={(e) => setGeneral(e.target.value)}
          />
          <div className="flex justify-end">
            <Button size="sm" variant="outline" disabled={general === null || upsertProfile.isPending}
              onClick={() => { upsertProfile.mutate({ general_notes: general }); setGeneral(null); }}>
              {upsertProfile.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Datas importantes */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <CardTitleRow icon={<CalendarHeart className="h-4 w-4" />} title="Datas importantes" />
          <div className="grid gap-2 sm:grid-cols-[150px_1fr_150px_auto]">
            <Select value={dateForm.kind} onValueChange={(v) => setDateForm({ ...dateForm, kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DATE_KINDS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Descrição (opcional)" value={dateForm.title}
              onChange={(e) => setDateForm({ ...dateForm, title: e.target.value })} />
            <Input type="date" value={dateForm.date} onChange={(e) => setDateForm({ ...dateForm, date: e.target.value })} />
            <Button disabled={!dateForm.date} onClick={() => {
              addDate.mutate(dateForm);
              setDateForm({ kind: "commemorative", title: "", date: "", notes: "" });
            }}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {dates.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{DATE_KINDS[d.kind] ?? d.kind}{d.title ? ` — ${d.title}` : ""}</p>
                <p className="text-xs text-muted-foreground">{dateBR(d.date)}{d.notes ? ` · ${d.notes}` : ""}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => delDate.mutate(d.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium truncate" title={value}>{value}</p>
    </div>
  );
}

function CardTitleRow({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <span className="text-primary">{icon}</span>{title}
    </div>
  );
}

/* =========================================================
   Resumo compacto + alerta — usado na tela de agendamento
   ========================================================= */
export function SmartProfileSummary({
  customerId, selectedStaffId, onOpen,
}: { customerId: string | null; selectedStaffId?: string | null; onOpen?: () => void }) {
  const { data: profile } = useSmartProfile("", customerId);
  const { data: notes = [] } = useSmartNotes(customerId);
  const { data: statsData } = useSmartStats(customerId);
  const stats = statsData?.stats;

  if (!customerId) return null;

  const noteList = Array.isArray(notes) ? notes : [];
  const pinned = noteList.filter((n) => n?.pinned);
  const restrictions = Array.isArray(profile?.restrictions) ? profile!.restrictions : [];
  const hasInfo = !!(noteList.length || restrictions.length || profile?.general_notes);

  const preferredId = profile?.preferred_staff_id ?? stats?.favoriteStaff?.id ?? null;
  const preferredName = profile?.preferred_staff_id
    ? stats?.favoriteStaff?.id === profile.preferred_staff_id ? stats?.favoriteStaff?.name : null
    : stats?.favoriteStaff?.name ?? null;

  return (
    <div className="space-y-2">
      {hasInfo && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 dark:bg-amber-500/10 dark:border-amber-500/30">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-xs">
              <p className="font-medium text-amber-900 dark:text-amber-200">🔔 Atenção</p>
              <p className="text-amber-800/90 dark:text-amber-200/80">Este cliente possui observações cadastradas.</p>
              {!!restrictions.length && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {RESTRICTIONS.filter((r) => restrictions.includes(r.key)).map((r) => (
                    <Badge key={r.key} variant="secondary" className="text-[10px]">{r.emoji} {r.label}</Badge>
                  ))}
                </div>
              )}
              {pinned.slice(0, 3).map((n) => (
                <p key={n.id} className="mt-1 text-amber-900 dark:text-amber-200">📌 {n.content}</p>
              ))}
            </div>
            {onOpen && (
              <Button size="sm" variant="outline" className="shrink-0" onClick={onOpen}>
                Visualizar Perfil
              </Button>
            )}
          </div>
        </div>
      )}

      {preferredName && selectedStaffId && preferredId && selectedStaffId !== preferredId && (
        <p className="text-xs text-muted-foreground">
          Este cliente costuma ser atendido por <span className="font-medium">{preferredName}</span>.
        </p>
      )}

      {!!stats?.totalVisits && (
        <p className="text-[11px] text-muted-foreground">
          {stats.totalVisits} visitas · ticket médio {brl(stats.avgTicketCents / 100)}
          {stats.favoriteService ? ` · favorito: ${stats.favoriteService.name}` : ""}
        </p>
      )}
    </div>
  );
}
