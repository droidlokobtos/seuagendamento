import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Ban } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/blocks")({
  component: Blocks,
});

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Blocks() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const [open, setOpen] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["time_blocks", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_blocks")
        .select("id,starts_at,ends_at,reason,staff_id,staff(name)")
        .eq("company_id", companyId)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-lite", companyId],
    queryFn: async () => (await supabase.from("staff").select("id,name").eq("company_id", companyId).order("name")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: any) => {
      const starts = new Date(v.starts_at);
      const ends = new Date(v.ends_at);
      if (ends <= starts) throw new Error("Fim deve ser após o início.");
      const { error } = await supabase.from("time_blocks").insert({
        company_id: companyId,
        staff_id: v.staff_id || null,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        reason: v.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bloqueio criado");
      qc.invalidateQueries({ queryKey: ["time_blocks", companyId] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["time_blocks", companyId] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bloqueios de horário</h1>
          <p className="text-sm text-muted-foreground">Reserve horários para folgas, feriados ou eventos.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Novo bloqueio</Button>
          </DialogTrigger>
          <BlockDialog staff={staff as any} onSave={(v) => save.mutate(v)} loading={save.isPending} />
        </Dialog>
      </div>

      {!data.length ? (
        <Card><CardContent className="p-12 text-center">
          <Ban className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Nenhum bloqueio cadastrado.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {(data as any[]).map((b) => (
            <Card key={b.id}>
              <CardContent className="p-4 flex items-start gap-3">
                <Ban className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {new Date(b.starts_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} — {new Date(b.ends_at).toLocaleString("pt-BR", { timeStyle: "short" })}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.staff?.name ? `👤 ${b.staff.name}` : "Empresa toda"}{b.reason ? ` · ${b.reason}` : ""}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(b.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockDialog({ staff, onSave, loading }: { staff: { id: string; name: string }[]; onSave: (v: any) => void; loading: boolean }) {
  const now = new Date();
  const [f, setF] = useState({
    staff_id: "",
    starts_at: toLocalInput(now),
    ends_at: toLocalInput(new Date(now.getTime() + 60 * 60_000)),
    reason: "",
  });
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Novo bloqueio</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Escopo</Label>
          <Select value={f.staff_id || "all"} onValueChange={(v) => setF({ ...f, staff_id: v === "all" ? "" : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Empresa toda</SelectItem>
              {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Início</Label><Input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></div>
          <div><Label>Fim</Label><Input type="datetime-local" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} /></div>
        </div>
        <div><Label>Motivo (opcional)</Label><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSave(f)} disabled={loading}>Salvar</Button></DialogFooter>
    </DialogContent>
  );
}
