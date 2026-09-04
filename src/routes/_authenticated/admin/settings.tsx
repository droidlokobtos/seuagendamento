import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Activity, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({ component: Settings });

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
  const [trialDays, setTrialDays] = useState("15");
  const [automationUrl, setAutomationUrl] = useState("https://seuagendamento.lovable.app");
  const [automationEnabled, setAutomationEnabled] = useState(true);

  const {
    data: automationHealth,
    refetch: refreshAutomation,
    isFetching: automationLoading,
  } = useQuery({
    queryKey: ["automation-health"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_automation_health");
      if (error) throw error;
      return data as {
        base_url?: string;
        enabled?: boolean;
        scheduled_jobs?: number;
        last_success_at?: string | null;
        last_failure_at?: string | null;
        failures_last_24h?: number;
        running_jobs?: number;
      };
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!data) return;
    setPixKey(data.pix_key ?? "");
    setPixHolder(data.pix_holder ?? "");
    setPixBank(data.pix_bank ?? "");
    setPlatformName(data.platform_name ?? "BeautySaaS");
    setReviewDays(String((data as any).review_expiration_days ?? 30));
    setTrialDays(String((data as any).default_trial_days ?? 15));
  }, [data]);

  useEffect(() => {
    if (!automationHealth) return;
    setAutomationUrl(automationHealth.base_url ?? "https://seuagendamento.lovable.app");
    setAutomationEnabled(automationHealth.enabled !== false);
  }, [automationHealth]);

  const save = useMutation({
    mutationFn: async () => {
      const review = Number(reviewDays);
      const trial = Number(trialDays);
      if (!Number.isFinite(review) || review < 1 || review > 365)
        throw new Error("Validade do link de avaliação deve ser entre 1 e 365 dias");
      if (!Number.isFinite(trial) || trial < 1 || trial > 365)
        throw new Error("O período de teste deve ser entre 1 e 365 dias");
      const payload = {
        pix_key: pixKey || null,
        pix_holder: pixHolder || null,
        pix_bank: pixBank || null,
        platform_name: platformName,
        review_expiration_days: review,
        default_trial_days: trial,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("platform_settings")
        .upsert({ id: true, ...payload } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["platform-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const saveAutomation = useMutation({
    mutationFn: async () => {
      const normalized = automationUrl.trim().replace(/\/$/, "");
      if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(normalized))
        throw new Error("Informe somente a URL HTTPS do sistema, sem caminhos adicionais");
      const { error } = await (supabase as any).rpc("update_automation_runtime_config", {
        _base_url: normalized,
        _enabled: automationEnabled,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Automação atualizada");
      qc.invalidateQueries({ queryKey: ["automation-health"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Não foi possível atualizar a automação",
      ),
  });

  const automationOk =
    automationHealth?.enabled === true &&
    automationHealth?.scheduled_jobs === 2 &&
    Number(automationHealth?.failures_last_24h ?? 0) === 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Configurações</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Dados globais da plataforma, testes e recebimento PIX.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Marca da plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Nome</Label>
          <Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cadastro e período de teste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Duração padrão do teste Pro (dias)</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
              className="max-w-32"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Novas empresas criadas pelo próprio usuário recebem automaticamente o plano Pro por
              este período. A alteração vale para novos testes; empresas existentes continuam
              editáveis individualmente em Empresas → Plano / Teste.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recebimento PIX</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Chave PIX</Label>
            <Input
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="CPF, e-mail, telefone ou aleatória"
            />
          </div>
          <div>
            <Label>Titular</Label>
            <Input value={pixHolder} onChange={(e) => setPixHolder(e.target.value)} />
          </div>
          <div>
            <Label>Banco</Label>
            <Input value={pixBank} onChange={(e) => setPixBank(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avaliações</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Validade padrão do link de avaliação (dias)</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={reviewDays}
            onChange={(e) => setReviewDays(e.target.value)}
            className="max-w-32"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Usada quando a empresa não define uma validade própria. Padrão: 30 dias.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Automação e confiabilidade
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Confirmações e convites são preparados em segundo plano. O envio do WhatsApp continua
              manual.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                automationOk
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-700"
              }
            >
              {automationOk ? "Operacional" : "Verificar"}
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => refreshAutomation()}
              disabled={automationLoading}
              title="Atualizar diagnóstico"
            >
              <RefreshCw className={`h-4 w-4 ${automationLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>URL pública usada nos links automáticos</Label>
            <Input
              value={automationUrl}
              onChange={(e) => setAutomationUrl(e.target.value)}
              placeholder="https://seuagendamento.lovable.app"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Configuração única para confirmações, avaliações e execução dos jobs.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Automações internas ativas</Label>
              <p className="text-xs text-muted-foreground">Desative somente durante manutenção.</p>
            </div>
            <Switch checked={automationEnabled} onCheckedChange={setAutomationEnabled} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Jobs ativos</p>
              <p className="font-semibold">{automationHealth?.scheduled_jobs ?? "—"}/2</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Falhas em 24h</p>
              <p className="font-semibold">{automationHealth?.failures_last_24h ?? "—"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Em execução</p>
              <p className="font-semibold">{automationHealth?.running_jobs ?? "—"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Último sucesso</p>
              <p className="font-semibold text-xs">
                {automationHealth?.last_success_at
                  ? new Date(automationHealth.last_success_at).toLocaleString("pt-BR")
                  : "Aguardando"}
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              disabled={saveAutomation.isPending}
              onClick={() => saveAutomation.mutate()}
            >
              {saveAutomation.isPending ? "Salvando…" : "Salvar automação"}
            </Button>
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
