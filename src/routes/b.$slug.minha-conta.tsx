import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyBookings, cancelMyBooking } from "@/lib/customer.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ChevronLeft, Calendar, Clock, LogOut, Plus, XCircle } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/b/$slug/minha-conta")({
  loader: async ({ params }) => {
    const { data: company } = await supabase
      .from("companies")
      .select("id,name,slug,logo_url,primary_color,secondary_color,status")
      .eq("slug", params.slug)
      .maybeSingle();
    if (!company || company.status === "suspended") throw notFound();
    return { company };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Minha conta — ${loaderData.company.name}` : "Minha conta" },
      { name: "robots", content: "noindex" },
    ],
  }),
  notFoundComponent: () => <div className="p-8 text-center">Página indisponível.</div>,
  component: MinhaContaPage,
});

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  scheduled: { label: "Agendado", variant: "default" },
  confirmed: { label: "Confirmado", variant: "default" },
  completed: { label: "Concluído", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  no_show: { label: "Faltou", variant: "outline" },
};

function MinhaContaPage() {
  const { company } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchBookings = useServerFn(getMyBookings);
  const cancelFn = useServerFn(cancelMyBooking);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/b/$slug/entrar", params: { slug } });
    });
  }, [navigate, slug]);

  const { data, isLoading } = useQuery({
    queryKey: ["my-bookings", slug],
    queryFn: () => fetchBookings({ data: { slug } }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { appointment_id: id } }),
    onSuccess: () => {
      toast.success("Agendamento cancelado.");
      qc.invalidateQueries({ queryKey: ["my-bookings", slug] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível cancelar"),
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/b/$slug", params: { slug } });
  };

  const primary = company.primary_color || "#0f172a";
  const accent = company.secondary_color || "#c9a86a";

  const now = Date.now();
  const bookings = data?.bookings ?? [];
  const upcoming = bookings.filter((b: any) => new Date(b.starts_at).getTime() >= now && b.status !== "cancelled");
  const past = bookings.filter((b: any) => new Date(b.starts_at).getTime() < now || b.status === "cancelled");

  return (
    <div className="min-h-screen bg-background pb-16">
      <div style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }} className="text-white">
        <div className="max-w-md mx-auto p-6 flex items-center gap-3">
          <Link to="/b/$slug" params={{ slug }} className="text-white/80 hover:text-white">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          {company.logo_url ? (
            <img src={company.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover ring-2 ring-white/40" />
          ) : (
            <div className="h-10 w-10 rounded-xl grid place-items-center bg-white/15 ring-2 ring-white/40">
              <Sparkles className="h-5 w-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-none truncate">{company.name}</h1>
            <p className="text-xs text-white/80 mt-1">
              Olá{data?.customer?.name ? `, ${data.customer.name.split(" ")[0]}` : ""}
            </p>
          </div>
          <button onClick={signOut} className="text-white/80 hover:text-white text-xs flex items-center gap-1">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 md:p-6 space-y-4">
        <Link to="/b/$slug" params={{ slug }}>
          <Button className="w-full" size="lg" style={{ background: primary }}>
            <Plus className="h-4 w-4 mr-2" /> Novo agendamento
          </Button>
        </Link>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Próximos</h2>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && !upcoming.length && (
            <Card><CardContent className="p-4 text-sm text-muted-foreground text-center">Nenhum agendamento futuro.</CardContent></Card>
          )}
          {upcoming.map((b: any) => (
            <BookingCard key={b.id} booking={b} accent={accent} onCancel={() => cancelMut.mutate(b.id)} canCancel />
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Histórico</h2>
          {!isLoading && !past.length && (
            <Card><CardContent className="p-4 text-sm text-muted-foreground text-center">Sem histórico ainda.</CardContent></Card>
          )}
          {past.map((b: any) => (
            <BookingCard key={b.id} booking={b} accent={accent} />
          ))}
        </section>
      </div>
    </div>
  );
}

function BookingCard({ booking, accent, canCancel, onCancel }: { booking: any; accent: string; canCancel?: boolean; onCancel?: () => void }) {
  const { slug } = Route.useParams();
  const d = new Date(booking.starts_at);
  const status = STATUS_LABEL[booking.status] ?? { label: booking.status, variant: "outline" as const };
  const total = Math.max(0, (booking.total_cents ?? 0) - (booking.discount_cents ?? 0)) / 100;
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" style={{ color: accent }} />
              <span className="font-medium">
                {d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
              </span>
              <Clock className="h-4 w-4 ml-2 text-muted-foreground" />
              <span>{d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <ul className="mt-2 space-y-0.5">
              {booking.services.map((s: any, i: number) => (
                <li key={i} className="text-sm truncate">• {s.name}</li>
              ))}
            </ul>
            {booking.staff && <p className="text-xs text-muted-foreground mt-1">Com {booking.staff.name}</p>}
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t">
          <span className="text-sm font-semibold">{brl(total)}</span>
          <div className="flex gap-1">
            {booking.status === "completed" && (
              <Link to="/b/$slug/avaliar/$appointmentId" params={{ slug, appointmentId: booking.id }}>
                <Button variant="ghost" size="sm">Avaliar</Button>
              </Link>
            )}
            {canCancel && onCancel && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={onCancel}>
                <XCircle className="h-4 w-4 mr-1" /> Cancelar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

