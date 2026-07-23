import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Scissors, ArrowUp, ArrowDown, Move, ZoomIn, ZoomOut } from "lucide-react";

// photo_position format: "<x>% <y>% <zoom>" (zoom optional, defaults 1)
function parsePos(v: string | null | undefined) {
  if (!v) return { x: 50, y: 50, z: 1 };
  const parts = v.trim().split(/\s+/);
  const x = parseFloat(parts[0]);
  const y = parseFloat(parts[1]);
  const z = parseFloat(parts[2]);
  return {
    x: Number.isFinite(x) ? x : 50,
    y: Number.isFinite(y) ? y : 50,
    z: Number.isFinite(z) && z > 0 ? z : 1,
  };
}
export function framedImgStyle(pos: string | null | undefined): React.CSSProperties {
  const { x, y, z } = parsePos(pos);
  return {
    objectPosition: `${x}% ${y}%`,
    transform: z !== 1 ? `scale(${z})` : undefined,
    transformOrigin: `${x}% ${y}%`,
  };
}
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ui/image-upload";

export const Route = createFileRoute("/_authenticated/app/services")({
  component: Services,
});

type S = {
  id: string; name: string; description: string | null;
  duration_min: number; price_cents: number; category: string | null;
  color: string | null; active: boolean; photo_url: string | null;
  photo_position: string | null; sort_order: number;
};

const EMPTY: Partial<S> = {
  name: "", description: "", duration_min: 30, price_cents: 0,
  category: "", color: "#8b7355", active: true, photo_url: null,
  photo_position: "center center", sort_order: 0,
};

function Services() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const [edit, setEdit] = useState<S | null>(null);
  const [open, setOpen] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["services", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as S[];
    },
  });

  const categories = useMemo(
    () => Array.from(new Set(data.map((s) => s.category).filter(Boolean))) as string[],
    [data],
  );

  const save = useMutation({
    mutationFn: async (v: Partial<S>) => {
      // Never send id/created_at/updated_at
      const { id: _id, created_at: _c, updated_at: _u, ...clean } = v as any;
      if (edit?.id) {
        const { error } = await supabase.from("services").update(clean).eq("id", edit.id);
        if (error) throw error;
      } else {
        const nextSort = data.length ? Math.max(...data.map((s) => s.sort_order ?? 0)) + 1 : 0;
        const { error } = await supabase.from("services").insert({
          ...clean, company_id: companyId, sort_order: clean.sort_order ?? nextSort,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(edit ? "Serviço atualizado" : "Serviço criado");
      qc.invalidateQueries({ queryKey: ["services", companyId] });
      setOpen(false); setEdit(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["services", companyId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const reorder = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      await Promise.all(
        updates.map((u) => supabase.from("services").update({ sort_order: u.sort_order }).eq("id", u.id)),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services", companyId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= data.length) return;
    const a = data[idx], b = data[j];
    reorder.mutate([
      { id: a.id, sort_order: b.sort_order ?? j },
      { id: b.id, sort_order: a.sort_order ?? idx },
    ]);
  };

  const openNew = () => { setEdit(null); setOpen(true); };
  const openEdit = (s: S) => { setEdit(s); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Serviços</h1>
          <p className="text-sm text-muted-foreground">Cadastre os serviços oferecidos.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo serviço</Button>
          </DialogTrigger>
          {open && (
            <ServiceDialog
              key={edit?.id ?? "new"}
              edit={edit}
              onSave={(v) => save.mutate(v)}
              loading={save.isPending}
              categories={categories}
            />
          )}
        </Dialog>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : !data.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Scissors className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhum serviço cadastrado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.map((s, idx) => (
            <Card key={s.id} className={!s.active ? "opacity-60 overflow-hidden" : "overflow-hidden"}>
              {s.photo_url && (
                <div className="h-32 w-full bg-muted overflow-hidden">
                  <img
                    src={s.photo_url}
                    alt={s.name}
                    className="h-full w-full object-cover"
                    style={framedImgStyle(s.photo_position)}
                  />
                </div>
              )}
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: s.color ?? "#8b7355" }} />
                      <p className="font-medium truncate">{s.name}</p>
                    </div>
                    {s.category && <p className="text-xs text-muted-foreground mt-0.5">{s.category}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" title="Mover para cima" disabled={idx === 0} onClick={() => move(idx, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Mover para baixo" disabled={idx === data.length - 1} onClick={() => move(idx, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(s.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.duration_min} min</span>
                  <span className="font-semibold">{brl(s.price_cents / 100)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceDialog({
  edit, onSave, loading, categories,
}: { edit: S | null; onSave: (v: Partial<S>) => void; loading: boolean; categories: string[] }) {
  const [f, setF] = useState<Partial<S>>(edit ? { ...edit } : { ...EMPTY });
  const [reposition, setReposition] = useState(false);

  return (
    <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{edit ? "Editar serviço" : "Novo serviço"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Foto</Label>
          <ImageUpload
            value={f.photo_url}
            folder="services"
            aspect="wide"
            onChange={(url) => setF({ ...f, photo_url: url, photo_position: "center center" })}
          />
          {f.photo_url && (
            <div className="mt-2 space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setReposition((v) => !v)}
              >
                <Move className="h-4 w-4 mr-2" />
                {reposition ? "Concluir reposicionamento" : "Reposicionar imagem"}
              </Button>
              {reposition && (
                <RepositionEditor
                  url={f.photo_url}
                  value={f.photo_position ?? "center center"}
                  onChange={(pos) => setF({ ...f, photo_position: pos })}
                />
              )}
            </div>
          )}
        </div>
        <div>
          <Label>Nome</Label>
          <Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Duração (min)</Label>
            <Input type="number" value={f.duration_min ?? 30}
              onChange={(e) => setF({ ...f, duration_min: parseInt(e.target.value || "0", 10) })} />
          </div>
          <div>
            <Label>Preço (R$)</Label>
            <Input type="number" step="0.01" value={((f.price_cents ?? 0) / 100).toString()}
              onChange={(e) => setF({ ...f, price_cents: Math.round(parseFloat(e.target.value || "0") * 100) })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Categoria</Label>
            <Input list="svc-categories" value={f.category ?? ""}
              onChange={(e) => setF({ ...f, category: e.target.value })} />
            <datalist id="svc-categories">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <Label>Cor</Label>
            <Input type="color" value={f.color ?? "#8b7355"} onChange={(e) => setF({ ...f, color: e.target.value })} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label>Ativo</Label>
          <Switch checked={f.active ?? true} onCheckedChange={(v) => setF({ ...f, active: v })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(f)} disabled={loading || !f.name}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function RepositionEditor({
  url, value, onChange,
}: { url: string; value: string; onChange: (pos: string) => void }) {
  const parse = (v: string) => {
    const [x, y] = v.split(/\s+/);
    return {
      x: parseFloat(x) || 50,
      y: parseFloat(y) || 50,
    };
  };
  const initial = /%/.test(value) ? parse(value) : { x: 50, y: 50 };
  const [pos, setPos] = useState(initial);
  const dragging = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onChange(`${pos.x}% ${pos.y}%`);
  }, [pos]);

  const updateFromEvent = (clientX: number, clientY: number) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100));
    setPos({ x, y });
  };

  return (
    <div className="space-y-2">
      <div
        ref={boxRef}
        className="relative h-40 w-full overflow-hidden rounded-md border bg-muted cursor-move select-none touch-none"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          updateFromEvent(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => { if (dragging.current) updateFromEvent(e.clientX, e.clientY); }}
        onPointerUp={() => { dragging.current = false; }}
      >
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover pointer-events-none"
          style={{ objectPosition: `${pos.x}% ${pos.y}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Arraste sobre a imagem para ajustar o enquadramento.
      </p>
    </div>
  );
}
