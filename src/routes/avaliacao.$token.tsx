import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { RATING_LABEL } from "@/lib/reviews";

export const Route = createFileRoute("/avaliacao/$token")({
  component: ReviewByToken,
  head: () => ({
    meta: [
      { title: "Avaliar atendimento | Seu Agendamento" },
      { name: "description", content: "Conte como foi seu atendimento em menos de 1 minuto." },
      { property: "og:title", content: "Avaliar atendimento" },
      { property: "og:description", content: "Conte como foi seu atendimento em menos de 1 minuto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Info = {
  status: string;
  expired: boolean;
  rating: number | null;
  googleReviewUrl: string | null;
  company: { name: string; logo_url: string | null; slug: string | null };
  appointment: { startsAt: string | null; customerName: string; staffName: string; services: string[] };
};

function ReviewByToken() {
  const { token } = Route.useParams();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [staffRating, setStaffRating] = useState(0);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [done, setDone] = useState<{ rating: number; googleReviewUrl: string | null } | null>(null);

  const { data, isLoading, error } = useQuery<Info>({
    queryKey: ["review-invite", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/review?token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Link inválido");
      return json as Info;
    },
    retry: false,
  });

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/public/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rating,
          comment: comment || undefined,
          staffRating: staffRating || undefined,
          wouldReturn: wouldReturn ?? undefined,
          wouldRecommend: wouldRecommend ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Não foi possível enviar sua avaliação");
      return json as { rating: number; googleReviewUrl: string | null };
    },
    onSuccess: (json) => {
      setDone({ rating: json.rating, googleReviewUrl: json.googleReviewUrl });
      if (json.googleReviewUrl) {
        setTimeout(() => window.open(json.googleReviewUrl!, "_blank", "noopener"), 1200);
      }
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
              {(error as any)?.message ?? "Este link de avaliação não é mais válido."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const closed = done || data.status === "answered" || data.expired || data.status === "expired";
  const when = data.appointment.startsAt ? new Date(data.appointment.startsAt) : null;

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="w-full max-w-md overflow-hidden">
        <div className="bg-primary/10 p-6 text-center">
          {data.company.logo_url ? (
            <img src={data.company.logo_url} alt={data.company.name} className="h-14 w-14 rounded-xl object-cover mx-auto" />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-primary text-primary-foreground grid place-items-center mx-auto">
              <Star className="h-6 w-6" />
            </div>
          )}
          <h1 className="mt-3 text-lg font-semibold">{data.company.name}</h1>
          <p className="text-sm text-muted-foreground">Avaliação de atendimento</p>
        </div>

        <CardContent className="p-6 space-y-5">
          {done ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <h2 className="text-xl font-semibold">Obrigado pela sua avaliação! 💛</h2>
              {done.googleReviewUrl ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Que bom que você gostou! Se puder, deixe também sua avaliação no Google — leva 20 segundos.
                  </p>
                  <Button className="w-full" onClick={() => window.open(done.googleReviewUrl!, "_blank", "noopener")}>
                    Avaliar no Google <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sua opinião foi registrada e será analisada pela equipe. Obrigado por nos ajudar a melhorar.
                </p>
              )}
              {data.company.slug && (
                <Button variant="ghost" className="w-full" onClick={() => (window.location.href = `/b/${data.company.slug}`)}>
                  Agendar novamente
                </Button>
              )}
            </div>
          ) : closed ? (
            <div className="text-center space-y-2 py-6">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto" />
              <h2 className="text-lg font-semibold">
                {data.status === "answered" ? "Avaliação já enviada" : "Link expirado"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {data.status === "answered"
                  ? "Obrigado! Já recebemos sua avaliação deste atendimento."
                  : "Este link de avaliação não está mais disponível."}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Cliente:</span> {data.appointment.customerName}</p>
                {when && (
                  <p>
                    <span className="text-muted-foreground">Atendimento:</span>{" "}
                    {when.toLocaleDateString("pt-BR")} às {when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
                {data.appointment.services.length > 0 && (
                  <p><span className="text-muted-foreground">Serviços:</span> {data.appointment.services.join(", ")}</p>
                )}
                <p><span className="text-muted-foreground">Profissional:</span> {data.appointment.staffName}</p>
              </div>

              <div className="text-center space-y-2">
                <p className="font-medium">Como foi seu atendimento?</p>
                <div className="flex gap-1 justify-center">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => setRating(n)}
                    >
                      <Star
                        className={`h-10 w-10 transition ${
                          n <= (hover || rating) ? "fill-primary text-primary" : "text-muted-foreground/40"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground h-5">{RATING_LABEL[hover || rating] ?? ""}</p>
              </div>

              {rating > 0 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Como foi o atendimento de {data.appointment.staffName}? (opcional)</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" aria-label={`Profissional ${n}`} onClick={() => setStaffRating(n)}>
                          <Star className={`h-6 w-6 ${n <= staffRating ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <YesNo label="Você voltaria a ser atendido aqui?" value={wouldReturn} onChange={setWouldReturn} />
                  <YesNo label="Recomendaria para amigos?" value={wouldRecommend} onChange={setWouldRecommend} />

                  <Textarea
                    rows={4}
                    maxLength={1000}
                    placeholder="Deixe um comentário (opcional)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />

                  <Button className="w-full" disabled={submit.isPending} onClick={() => submit.mutate()}>
                    {submit.isPending ? "Enviando…" : "Enviar avaliação"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label} (opcional)</p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant={value === true ? "default" : "outline"} onClick={() => onChange(true)}>
          Sim
        </Button>
        <Button type="button" size="sm" variant={value === false ? "default" : "outline"} onClick={() => onChange(false)}>
          Não
        </Button>
      </div>
    </div>
  );
}
