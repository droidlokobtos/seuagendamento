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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ui/image-upload";
import { toast } from "sonner";
import { Star, Trash2, Pencil, Plus, ImageIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/gallery")({
  component: GalleryPage,
});

type Photo = {
  id: string;
  company_id: string;
  category: string | null;
  title: string | null;
  description: string | null;
  image_url: string;
  featured: boolean;
  sort_order: number;
  created_at: string;
};

const DEFAULT_CATEGORIES = ["Antes e Depois", "Cabelos", "Unhas", "Maquiagem", "Estética", "Ambiente", "Outros"];

function GalleryPage() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;

  const [editing, setEditing] = useState<Partial<Photo> | null>(null);
  const [filterCat, setFilterCat] = useState<string>("all");

  const { data: photos = [] } = useQuery({
    queryKey: ["gallery", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_photos" as any)
        .select("*")
        .eq("company_id", companyId)
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Photo[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (p: Partial<Photo>) => {
      if (!p.image_url) throw new Error("Envie uma imagem.");
      const payload: any = {
        company_id: companyId,
        category: p.category?.trim() || null,
        title: p.title?.trim() || null,
        description: p.description?.trim() || null,
        image_url: p.image_url,
        featured: !!p.featured,
        sort_order: p.sort_order ?? 0,
      };
      if (p.id) {
        const { error } = await supabase.from("gallery_photos" as any).update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("gallery_photos" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Foto salva");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["gallery", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gallery_photos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Foto removida");
      qc.invalidateQueries({ queryKey: ["gallery", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleFeatured = useMutation({
    mutationFn: async (p: Photo) => {
      const { error } = await supabase
        .from("gallery_photos" as any)
        .update({ featured: !p.featured })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gallery", companyId] }),
  });

  const categories = Array.from(new Set(photos.map((p) => p.category).filter(Boolean))) as string[];
  const visible = filterCat === "all" ? photos : photos.filter((p) => (p.category ?? "") === filterCat);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Galeria de Trabalhos</h1>
          <p className="text-sm text-muted-foreground">Catálogo digital com fotos dos serviços realizados.</p>
        </div>
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ featured: false, sort_order: 0 })}>
              <Plus className="h-4 w-4 mr-2" /> Nova foto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Editar foto" : "Nova foto"}</DialogTitle>
            </DialogHeader>
            {editing && <PhotoForm value={editing} onChange={setEditing} />}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={() => editing && upsert.mutate(editing)} disabled={upsert.isPending || !editing?.image_url}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCat("all")}
            className={`px-3 py-1.5 rounded-full text-xs border ${filterCat === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            Todas ({photos.length})
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              className={`px-3 py-1.5 rounded-full text-xs border ${filterCat === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma foto ainda. Adicione trabalhos para mostrar no seu portal público.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {visible.map((p) => (
            <Card key={p.id} className="overflow-hidden group">
              <div className="relative aspect-square bg-muted">
                <img src={p.image_url} alt={p.title ?? ""} className="w-full h-full object-cover" />
                {p.featured && (
                  <Badge className="absolute top-2 left-2" style={{ background: "#c9a961" }}>
                    <Star className="h-3 w-3 mr-1 fill-current" /> Destaque
                  </Badge>
                )}
              </div>
              <CardContent className="p-3 space-y-1">
                {p.title && <p className="text-sm font-medium truncate">{p.title}</p>}
                {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                <div className="flex gap-1 pt-2">
                  <Button size="sm" variant="ghost" className="flex-1 h-8" onClick={() => toggleFeatured.mutate(p)}>
                    <Star className={`h-3.5 w-3.5 ${p.featured ? "fill-current text-amber-500" : ""}`} />
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1 h-8" onClick={() => setEditing(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-8 text-destructive"
                    onClick={() => confirm("Remover esta foto?") && remove.mutate(p.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoForm({ value, onChange }: { value: Partial<Photo>; onChange: (p: Partial<Photo>) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Foto</Label>
        <ImageUpload
          value={value.image_url}
          folder="gallery"
          aspect="square"
          onChange={(url) => onChange({ ...value, image_url: url ?? "" })}
        />
      </div>
      <div>
        <Label>Título</Label>
        <Input
          value={value.title ?? ""}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="Ex.: Corte degradê"
        />
      </div>
      <div>
        <Label>Descrição</Label>
        <Textarea
          value={value.description ?? ""}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          placeholder="Breve descrição do serviço realizado"
        />
      </div>
      <div>
        <Label>Categoria</Label>
        <Input
          list="gallery-categories"
          value={value.category ?? ""}
          onChange={(e) => onChange({ ...value, category: e.target.value })}
          placeholder="Ex.: Antes e Depois"
        />
        <datalist id="gallery-categories">
          {DEFAULT_CATEGORIES.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>
      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
        <div>
          <p className="text-sm font-medium">Marcar como destaque</p>
          <p className="text-xs text-muted-foreground">Aparece primeiro no portal público.</p>
        </div>
        <Switch
          checked={!!value.featured}
          onCheckedChange={(v) => onChange({ ...value, featured: v })}
        />
      </div>
    </div>
  );
}
