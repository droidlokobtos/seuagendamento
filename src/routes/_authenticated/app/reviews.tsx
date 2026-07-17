import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/reviews")({ component: Reviews });

type R = {
  id: string; rating: number; comment: string | null; published: boolean; created_at: string;
  customer_id: string | null; appointment_id: string | null; staff_id: string | null;
};

function Reviews() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();

  const { data = [] } = useQuery({
    queryKey: ["reviews", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("*")
        .eq("company_id", activeCompany!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as R[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["reviews-customers", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id,name").eq("company_id", activeCompany!.id);
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const custMap = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c.name])), [customers]);

  const avg = data.length ? (data.reduce((a, r) => a + r.rating, 0) / data.length) : 0;

  const toggle = useMutation({
    mutationFn: async (r: R) => {
      const { error } = await supabase.from("reviews").update({ published: !r.published }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("reviews").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reviews"] }); toast.success("Removida"); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Avaliações</h1>
          <p className="text-sm text-muted-foreground">Depoimentos dos seus clientes.</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold flex items-center gap-1 justify-end">{avg.toFixed(1)}<Star className="h-6 w-6 fill-primary text-primary" /></div>
          <div className="text-xs text-muted-foreground">{data.length} avaliações</div>
        </div>
      </div>

      <div className="grid gap-3">
        {data.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
                    ))}
                    {!r.published && <Badge variant="secondary" className="ml-2">Oculta</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {r.customer_id ? custMap[r.customer_id] ?? "Cliente" : "Anônimo"} · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => toggle.mutate(r)} title={r.published ? "Ocultar" : "Publicar"}>
                    {r.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              {r.comment && <p className="text-sm">"{r.comment}"</p>}
            </CardContent>
          </Card>
        ))}
        {data.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma avaliação ainda. Elas chegam automaticamente após atendimentos concluídos.</p>}
      </div>
    </div>
  );
}
