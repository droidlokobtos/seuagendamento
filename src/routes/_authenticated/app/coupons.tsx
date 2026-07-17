import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Ticket, Copy } from "lucide-react";
import { brl, dateBR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/coupons")({
  component: Coupons,
});

type C = {
  id: string; code: string; description: string | null;
  discount_type: "percent" | "fixed"; discount_value: number;
  max_uses: number | null; uses_count: number;
  valid_from: string | null; valid_until: string | null; active: boolean;
};

function Coupons() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<C | null>(null);

  const { data: coupons = [] } = useQuery({
    queryKey: ["coupons", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons").select("*")
        .eq("company_id", activeCompany!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as C[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<C>) => {
      const row = { ...payload, company_id: activeCompany!.id };
      if (editing) {
        const { error } = await supabase.from("coupons").update(row).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coupons").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons"] });
      toast.success(editing ? "Cupom atualizado" : "Cupom criado");
      setOpen(false); setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coupons"] }); toast.success("Removido"); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cupons</h1>
          <p className="text-sm text-muted-foreground">Descontos para atrair e fidelizar clientes.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Novo cupom</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar cupom" : "Novo cupom"}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                upsert.mutate({
                  code: String(f.get("code")).toUpperCase().trim(),
                  description: String(f.get("description") || "") || null,
                  discount_type: f.get("discount_type") as "percent" | "fixed",
                  discount_value: Number(f.get("discount_value")),
                  max_uses: f.get("max_uses") ? Number(f.get("max_uses")) : null,
                  valid_from: (f.get("valid_from") as string) || null,
                  valid_until: (f.get("valid_until") as string) || null,
                  active: f.get("active") === "on",
                });
              }}
            >
              <div><Label>Código</Label><Input name="code" required defaultValue={editing?.code} placeholder="BEM10" /></div>
              <div><Label>Descrição</Label><Input name="description" defaultValue={editing?.description ?? ""} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select name="discount_type" defaultValue={editing?.discount_type ?? "percent"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentual (%)</SelectItem>
                      <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Valor</Label><Input name="discount_value" type="number" step="0.01" required defaultValue={editing?.discount_value} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Válido de</Label><Input name="valid_from" type="date" defaultValue={editing?.valid_from ?? ""} /></div>
                <div><Label>Válido até</Label><Input name="valid_until" type="date" defaultValue={editing?.valid_until ?? ""} /></div>
              </div>
              <div><Label>Máx. usos (opcional)</Label><Input name="max_uses" type="number" defaultValue={editing?.max_uses ?? ""} /></div>
              <div className="flex items-center gap-2">
                <Switch name="active" defaultChecked={editing?.active ?? true} />
                <Label>Ativo</Label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={upsert.isPending}>Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {coupons.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          <Ticket className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Nenhum cupom cadastrado.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {coupons.map((c) => (
            <Card key={c.id} className={!c.active ? "opacity-60" : ""}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-lg font-bold tracking-wider">{c.code}</p>
                      <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copiado"); }}>
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) remove.mutate(c.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm">
                  <span className="font-semibold text-primary">
                    {c.discount_type === "percent" ? `${c.discount_value}%` : brl(c.discount_value * 100)}
                  </span>{" "}
                  de desconto
                </p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Usos: {c.uses_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</p>
                  {(c.valid_from || c.valid_until) && (
                    <p>
                      {c.valid_from ? dateBR(c.valid_from) : "sem início"} → {c.valid_until ? dateBR(c.valid_until) : "sem fim"}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
