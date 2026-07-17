import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Check, Copy, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/whatsapp")({
  component: WhatsAppQueue,
});

const KIND_LABEL: Record<string, string> = {
  reminder_24h: "Lembrete 24h",
  reminder_1h: "Lembrete 1h",
  reminder_review: "Pedir avaliação",
};

function WhatsAppQueue() {
  const { activeCompany } = useCompany();
  const qc = useQueryClient();
  const companyId = activeCompany?.id;

  const { data = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["wa-queue", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("company_id", companyId)
        .in("kind", ["reminder_24h", "reminder_1h", "reminder_review"])
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    enabled: !!companyId,
    refetchInterval: 60_000,
  });

  const markSent = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["wa-queue", companyId] });
    qc.invalidateQueries({ queryKey: ["notifications", companyId] });
  };

  const openWa = (n: any) => {
    if (!n.metadata?.wa_url) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    window.open(n.metadata.wa_url, "_blank", "noopener");
    void markSent(n.id);
  };

  const copyMsg = async (n: any) => {
    await navigator.clipboard.writeText(n.metadata?.message ?? "");
    toast.success("Mensagem copiada");
  };

  const runNow = async () => {
    try {
      const res = await fetch("/api/public/hooks/reminders", { method: "POST" });
      const j = await res.json();
      toast.success(`${j.processed ?? 0} lembretes gerados`);
      refetch();
    } catch {
      toast.error("Falha ao processar");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Fila de lembretes prontos para envio. Clique em "Enviar" e o WhatsApp abre com a mensagem preenchida.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={runNow} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Processar agora
        </Button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data.length ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-3 opacity-40" />
            Nenhum lembrete pendente no momento.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((n: any) => (
            <Card key={n.id}>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{KIND_LABEL[n.kind] ?? n.kind}</Badge>
                  <CardTitle className="text-base">{n.metadata?.customer_name ?? "Cliente"}</CardTitle>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("pt-BR")}
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{n.metadata?.phone ?? "Sem telefone"}</p>
                <pre className="whitespace-pre-wrap text-sm bg-muted/50 rounded-md p-3 font-sans">
                  {n.metadata?.message}
                </pre>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => openWa(n)} disabled={!n.metadata?.wa_url}>
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Enviar no WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copyMsg(n)}>
                    <Copy className="h-4 w-4 mr-2" /> Copiar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => markSent(n.id)}>
                    <Check className="h-4 w-4 mr-2" /> Marcar como enviado
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
