import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: Settings,
});

function Settings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => (await supabase.from("platform_settings").select("*").maybeSingle()).data,
  });

  const [pixKey, setPixKey] = useState("");
  const [pixHolder, setPixHolder] = useState("");
  const [pixBank, setPixBank] = useState("");
  const [platformName, setPlatformName] = useState("BeautySaaS");
  const [reviewDays, setReviewDays] = useState("30");

  useEffect(() => {
    if (data) {
      setPixKey(data.pix_key ?? "");
      setPixHolder(data.pix_holder ?? "");
      setPixBank(data.pix_bank ?? "");
      setPlatformName(data.platform_name ?? "BeautySaaS");
      setReviewDays(String((data as any).review_expiration_days ?? 30));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const days = Number(reviewDays);
      if (!Number.isFinite(days) || days < 1 || days > 365)
        throw new Error("Validade do link de avaliação deve ser entre 1 e 365 dias");
      const payload = {
        pix_key: pixKey || null,
        pix_holder: pixHolder || null,
        pix_bank: pixBank || null,
        platform_name: platformName,
        review_expiration_days: days,
        updated_at: new Date().toISOString(),
      };
      // platform_settings is a singleton row (id: boolean true)
      const { error } = await supabase.from("platform_settings").upsert({ id: true, ...payload });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Configurações salvas"); qc.invalidateQueries({ queryKey: ["platform-settings"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });


  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Configurações</h2>
        <p className="text-sm text-muted-foreground mt-1">Dados globais da plataforma e recebimento PIX.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Marca da plataforma</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Nome</Label><Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recebimento PIX</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Chave PIX</Label><Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, e-mail, telefone ou aleatória" /></div>
          <div><Label>Titular</Label><Input value={pixHolder} onChange={(e) => setPixHolder(e.target.value)} /></div>
          <div><Label>Banco</Label><Input value={pixBank} onChange={(e) => setPixBank(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Avaliações</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Validade padrão do link de avaliação (dias)</Label>
            <Input type="number" min={1} max={365} value={reviewDays} onChange={(e) => setReviewDays(e.target.value)} className="max-w-32" />
            <p className="text-xs text-muted-foreground mt-1">
              Usada quando a empresa não define uma validade própria. Padrão: 30 dias.
            </p>
          </div>
        </CardContent>
      </Card>


      <div className="flex justify-end">
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}
