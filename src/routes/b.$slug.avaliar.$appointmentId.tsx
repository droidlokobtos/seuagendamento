import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getPublicCompany } from "@/lib/public-portal.functions";

export const Route = createFileRoute("/b/$slug/avaliar/$appointmentId")({ component: ReviewPage });

type Ctx = { company_id: string; company_name: string; customer_id: string | null; staff_id: string | null };

function ReviewPage() {
  const { slug, appointmentId } = Route.useParams();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [existing, setExisting] = useState(false);

  useEffect(() => {
    (async () => {
      const comp = await getPublicCompany({ data: { slug } });
      if (!comp) return;
      const { data: appt } = await supabase.from("appointments")
        .select("id,company_id,customer_id,staff_id")
        .eq("id", appointmentId).eq("company_id", comp.id as string).maybeSingle();
      if (!appt) return;
      setCtx({ company_id: comp.id as string, company_name: comp.name as string, customer_id: appt.customer_id, staff_id: appt.staff_id });
      const { data: existingReview } = await supabase.from("reviews").select("id").eq("appointment_id", appointmentId).maybeSingle();
      if (existingReview) setExisting(true);
    })();
  }, [slug, appointmentId]);

  const submit = async () => {
    if (!ctx) return;
    const { error } = await supabase.from("reviews").insert({
      company_id: ctx.company_id, appointment_id: appointmentId,
      customer_id: ctx.customer_id, staff_id: ctx.staff_id,
      rating, comment: comment || null, published: true,
    } as any);
    if (error) { toast.error(error.message); return; }
    setDone(true);
  };

  if (!ctx) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;

  return (
    <div className="min-h-dvh bg-muted/30 grid place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          {done || existing ? (
            <div className="text-center space-y-3 py-6">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <h1 className="text-xl font-semibold">Obrigado!</h1>
              <p className="text-sm text-muted-foreground">{existing ? "Esta avaliação já foi enviada." : "Sua avaliação foi registrada."}</p>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-xl font-semibold">Como foi seu atendimento?</h1>
                <p className="text-sm text-muted-foreground">{ctx.company_name} agradece seu feedback.</p>
              </div>
              <div className="flex gap-1 justify-center py-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)}>
                    <Star className={`h-10 w-10 transition ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
                  </button>
                ))}
              </div>
              <Textarea placeholder="Conte como foi (opcional)" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
              <Button className="w-full" onClick={submit}>Enviar avaliação</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
