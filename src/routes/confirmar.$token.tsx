import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CalendarCheck, CheckCircle2, XCircle, Loader2, Clock, User, Scissors, Phone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/confirmar/$token")({
  component: ConfirmPage,
  head: () => ({
    meta: [
      { title: "Confirmar agendamento | Seu Agendamento" },
      { name: "description", content: "Confirme ou cancele seu horário em poucos segundos." },
      { property: "og:title", content: "Confirmar agendamento" },
      { property: "og:description", content: "Confirme ou cancele seu horário em poucos segundos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Info = {
  status: string;
  expired: boolean;
  respondedAt: string | null;
  cancelReason: string | null;
  company: { name: string; logo_url: string | null; slug: string | null };
  appointment: {
    startsAt: string | null;
    status: string | null;
    customerName: string;
    customerPhone: string;
    staffName: string;
    services: string[];
  };
};

function ConfirmPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");

  const { data, isLoading, error } = useQuery<Info>({
    queryKey: ["confirmation", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/confirm?token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Link inválido");
      return json as Info;
    },
    retry: false,
  });

  const respond = useMutation({
    mutationFn: async (action: "confirm" | "cancel") => {
      const res = await fetch("/api/public/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, reason: reason || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Não foi possível registrar sua resposta");
      return json;
    },
    onSuccess: (_d, action) => {
      toast.success(action === "confirm" ? "Presença confirmada!" : "Agendamento cancelado");
      void qc.invalidateQueries({ queryKey: ["confirmation", token] });
      setShowCancel(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center space-y-2">
            <XCircle className="h-10 w-10 mx-auto text-destructive" />
            <h1 className="text-lg font-semibold">Link inválido</h1>
            <p className="text-sm text-muted-foreground">
              {(error as any)?.message ?? "Este link de confirmação não é mais válido."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const when = data.appointment.startsAt ? new Date(data.appointment.startsAt) : null;
  const answered = data.status === "confirmed" || data.status === "cancelled";
  const closed = answered || data.expired || data.status === "expired";

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="w-full max-w-md overflow-hidden">
        <div className="bg-primary/10 p-6 text-center">
          {data.company.logo_url ? (
            <img src={data.company.logo_url} alt={data.company.name} className="h-14 w-14 rounded-xl object-cover mx-auto" />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-primary text-primary-foreground grid place-items-center mx-auto">
              <CalendarCheck className="h-6 w-6" />
            </div>
          )}
          <h1 className="mt-3 text-lg font-semibold">{data.company.name}</h1>
          <p className="text-sm text-muted-foreground">Confirmação de agendamento</p>
        </div>

        <CardContent className="p-6 space-y-4">
          <div className="space-y-3 text-sm">
            <Row icon={<User className="h-4 w-4" />} label="Cliente" value={data.appointment.customerName || "—"} />
            <Row icon={<Phone className="h-4 w-4" />} label="Telefone" value={data.appointment.customerPhone} />
            <Row
              icon={<Scissors className="h-4 w-4" />}
              label="Serviço"
              value={data.appointment.services.join(", ") || "Atendimento"}
            />
            <Row icon={<User className="h-4 w-4" />} label="Profissional" value={data.appointment.staffName} />
            <Row
              icon={<Clock className="h-4 w-4" />}
              label="Data e horário"
              value={
                when
                  ? `${when.toLocaleDateString("pt-BR")} às ${when.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "—"
              }
            />
          </div>

          {data.status === "confirmed" && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-600" />
              <p className="mt-1 text-sm font-medium">Presença confirmada. Até logo! ✨</p>
            </div>
          )}

          {data.status === "cancelled" && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center">
              <XCircle className="h-6 w-6 mx-auto text-red-600" />
              <p className="mt-1 text-sm font-medium">Agendamento cancelado.</p>
              {data.cancelReason && <p className="text-xs text-muted-foreground mt-1">{data.cancelReason}</p>}
            </div>
          )}

          {!answered && (data.expired || data.status === "expired") && (
            <div className="rounded-lg border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
              Este link expirou. Fale com o estabelecimento para reagendar.
            </div>
          )}

          {!closed && (
            <div className="space-y-3">
              {!showCancel ? (
                <div className="grid gap-2">
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate("confirm")}
                  >
                    🟢 Confirmar presença
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setShowCancel(true)}>
                    🔴 Cancelar agendamento
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Motivo do cancelamento (opcional)</Label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="ghost" onClick={() => setShowCancel(false)}>
                      Voltar
                    </Button>
                    <Button variant="destructive" disabled={respond.isPending} onClick={() => respond.mutate("cancel")}>
                      Confirmar cancelamento
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium break-words">{value}</p>
      </div>
    </div>
  );
}
