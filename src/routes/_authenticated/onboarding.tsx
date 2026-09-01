import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Building2, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createSelfServiceTrialCompany } from "@/lib/onboarding.functions";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({ component: Onboarding });

function Onboarding() {
  const navigate = useNavigate();
  const { user, companyIds, isSuperAdmin, refresh } = useAuth();
  const createCompany = useServerFn(createSelfServiceTrialCompany);
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState(() => String(user?.user_metadata?.full_name ?? ""));
  const [phone, setPhone] = useState("");
  const [nicheId, setNicheId] = useState("");

  const { data: niches = [] } = useQuery({
    queryKey: ["onboarding-niches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("niches").select("id,name").eq("active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["public-trial-settings"],
    queryFn: async () => (await supabase.from("platform_settings").select("*").eq("id", true).maybeSingle()).data as any,
  });
  const trialDays = Number(settings?.default_trial_days ?? 15);

  const alreadyLinked = companyIds.length > 0 || isSuperAdmin;
  const canSubmit = useMemo(() => companyName.trim().length >= 2 && ownerName.trim().length >= 2 && phone.replace(/\D/g, "").length >= 11 && !!nicheId, [companyName, ownerName, phone, nicheId]);

  const mutation = useMutation({
    mutationFn: async () => createCompany({ data: { company_name: companyName, owner_name: ownerName, phone, niche_id: nicheId } }),
    onSuccess: async (res) => {
      await refresh();
      toast.success("Empresa criada", { description: `Seu teste do plano Pro está ativo por ${res.trial_days} dias.` });
      void navigate({ to: "/app", replace: true });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível criar sua empresa"),
  });

  if (alreadyLinked) {
    void navigate({ to: "/home", replace: true });
    return null;
  }

  return <div className="min-h-screen bg-muted/20 px-4 py-10 sm:py-16">
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Building2 className="h-7 w-7" /></div>
        <p className="mt-5 text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">Configuração inicial</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Crie sua empresa</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">Comece sem falar com o suporte. Sua empresa recebe automaticamente acesso completo ao plano Pro durante o período de teste.</p>
      </div>

      <Card className="shadow-sm"><CardContent className="p-6 sm:p-8 space-y-5">
        <div className="rounded-xl border bg-primary/5 p-4 flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-primary mt-0.5"/><div><p className="font-medium text-sm">Teste Pro por {trialDays} dias</p><p className="text-xs text-muted-foreground mt-1">Todos os recursos do plano Pro ficam liberados. Ao final do teste, o painel será bloqueado caso não exista contratação ativa.</p></div></div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Label>Nome da empresa</Label><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex.: Studio Bella" /></div>
          <div><Label>Responsável</Label><Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></div>
          <div><Label>WhatsApp</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(17) 99999-9999" /></div>
          <div className="sm:col-span-2"><Label>Segmento</Label><Select value={nicheId} onValueChange={setNicheId}><SelectTrigger><SelectValue placeholder="Selecione o segmento" /></SelectTrigger><SelectContent>{niches.map((n:any) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}</SelectContent></Select></div>
        </div>

        <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-sm"><div className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5"/><span>Acesso completo ao plano Pro durante o teste</span></div><div className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5"/><span>Nenhuma contratação é feita automaticamente</span></div><div className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5"/><span>Você poderá escolher um plano antes do encerramento do período</span></div></div>

        <Button className="w-full" size="lg" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : null}{mutation.isPending ? "Criando empresa..." : "Criar empresa e iniciar teste Pro"}</Button>
      </CardContent></Card>
    </div>
  </div>;
}
