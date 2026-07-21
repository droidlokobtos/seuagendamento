import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MapPin, Phone, Check, Calendar, Clock, ChevronLeft, ChevronRight, User, Instagram, Facebook, Globe, Star, MessageCircle, X as XIcon, Image as ImageIcon } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/b/$slug/")({
  loader: async ({ params }) => {
    const { data: company, error } = await supabase
      .from("companies")
      .select("id,name,slug,logo_url,banner_url,primary_color,secondary_color,address,whatsapp,phone,email,status,online_booking_enabled,description,welcome_message,instagram_url,facebook_url,tiktok_url,website_url,show_staff_on_portal,show_reviews_on_portal,min_advance_min,max_advance_days")
      .eq("slug", params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!company || company.status === "suspended") throw notFound();
    return { company };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `Agendar em ${loaderData.company.name}` },
          { name: "description", content: `Escolha o serviço e horário para agendar com ${loaderData.company.name}.` },
          { property: "og:title", content: `Agendar em ${loaderData.company.name}` },
          { property: "og:description", content: `Reserve seu horário online.` },
          ...(loaderData.company.logo_url
            ? [{ property: "og:image", content: loaderData.company.logo_url }]
            : []),
        ]
      : [{ title: "Agendamento" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Página não encontrada</h1>
        <p className="text-muted-foreground mt-2">Este link de agendamento não está disponível.</p>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">Erro ao carregar</h1>
        <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
      </div>
    </div>
  ),
  component: BookingPage,
});

type Service = { id: string; name: string; description: string | null; duration_min: number; price_cents: number; category: string | null; color: string | null };
type Staff = { id: string; name: string; role_title: string | null; photo_url: string | null; color: string | null };
type Hours = { weekday: number; start_time: string; end_time: string; closed: boolean };
type TimeBlock = { starts_at: string; ends_at: string; staff_id: string | null };

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DEFAULT_HOURS = { start_time: "09:00", end_time: "18:00", closed: false };

// Fallback: se a empresa não configurou nenhum horário, o portal opera 09:00-18:00 todos os dias.
// Se configurou pelo menos 1 dia, dias sem row são tratados como fechados (comportamento original).
function resolveHours(weekday: number, hours: Hours[]): { start_time: string; end_time: string; closed: boolean } | null {
  if (!hours.length) return DEFAULT_HOURS;
  const h = hours.find((x) => x.weekday === weekday);
  if (!h) return null;
  if (h.closed) return null;
  return { start_time: h.start_time, end_time: h.end_time, closed: false };
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

function BookingPage() {
  const { company } = Route.useLoaderData();
  const companyId = company.id;
  const showStaffStep = company.show_staff_on_portal !== false;

  const [step, setStep] = useState<Step>(1);
  const [selected, setSelected] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [dateStr, setDateStr] = useState<string>(new Date().toISOString().slice(0, 10));
  const [timeStr, setTimeStr] = useState<string>("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount_cents: number; message: string } | null>(null);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ starts_at: string } | null>(null);
  const [session, setSession] = useState<{ userId: string; email?: string | null } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setSession({ userId: data.user.id, email: data.user.email });
        const meta = (data.user.user_metadata ?? {}) as { full_name?: string; phone?: string };
        setForm((f) => ({
          ...f,
          name: f.name || meta.full_name || "",
          phone: f.phone || meta.phone || "",
          email: f.email || data.user.email || "",
        }));
      }
    });
  }, []);

  const { data: services = [] } = useQuery({
    queryKey: ["pub_services", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*")
        .eq("company_id", companyId).eq("active", true).order("name");
      if (error) throw error;
      return (data ?? []) as Service[];
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["pub_staff", companyId, selected.map((s) => s.id).join(",")],
    queryFn: async () => {
      const ids = selected.map((s) => s.id);
      if (!ids.length) return [];
      const { data: links } = await supabase.from("staff_services").select("staff_id,service_id").in("service_id", ids);
      const { data: st } = await supabase.from("staff").select("id,name,role_title,photo_url,color,company_id,active")
        .eq("company_id", companyId).eq("active", true);
      const counts = new Map<string, Set<string>>();
      (links ?? []).forEach((l: any) => {
        if (!counts.has(l.staff_id)) counts.set(l.staff_id, new Set());
        counts.get(l.staff_id)!.add(l.service_id);
      });
      return ((st ?? []) as any[]).filter((s) => counts.get(s.id)?.size === ids.length) as Staff[];
    },
    enabled: selected.length > 0,
  });

  const { data: hours = [] } = useQuery({
    queryKey: ["pub_hours", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_hours").select("weekday,start_time,end_time,closed").eq("company_id", companyId);
      if (error) throw error;
      return (data ?? []) as Hours[];
    },
  });

  const { data: taken = [] } = useQuery({
    queryKey: ["pub_taken", companyId, dateStr, staff?.id ?? "any"],
    queryFn: async () => {
      const from = `${dateStr}T00:00:00`;
      const to = `${dateStr}T23:59:59`;
      let q = supabase.from("appointments").select("starts_at,ends_at,staff_id")
        .eq("company_id", companyId).neq("status", "cancelled")
        .gte("starts_at", from).lte("starts_at", to);
      if (staff) q = q.eq("staff_id", staff.id);
      const { data } = await q;
      return (data ?? []) as { starts_at: string; ends_at: string; staff_id: string | null }[];
    },
    enabled: !!dateStr,
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ["pub_blocks", companyId, dateStr, staff?.id ?? "any"],
    queryFn: async () => {
      const from = `${dateStr}T00:00:00`;
      const to = `${dateStr}T23:59:59`;
      const { data } = await supabase.from("time_blocks").select("starts_at,ends_at,staff_id")
        .eq("company_id", companyId)
        .lt("starts_at", to).gt("ends_at", from);
      const list = (data ?? []) as TimeBlock[];
      // Bloqueios sem staff_id são da empresa toda; com staff_id valem só se combinar com o selecionado (ou qualquer, se "any")
      return list.filter((b) => !b.staff_id || !staff || b.staff_id === staff.id);
    },
    enabled: !!dateStr,
  });

  const totalMin = selected.reduce((s, x) => s + x.duration_min, 0);
  const totalPrice = selected.reduce((s, x) => s + x.price_cents, 0) / 100;

  const minAdvanceMin = (company as any).min_advance_min ?? 0;
  const maxAdvanceDays = (company as any).max_advance_days ?? 60;

  const slots = useMemo(() => {
    if (!dateStr || !totalMin) return [] as string[];
    const d = new Date(dateStr + "T00:00:00");
    const wd = d.getDay();
    const h = resolveHours(wd, hours);
    if (!h) return [];
    const [sh, sm] = h.start_time.split(":").map(Number);
    const [eh, em] = h.end_time.split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    const gran = 15;
    const now = Date.now();
    const minStart = now + minAdvanceMin * 60_000;
    const out: string[] = [];
    for (let m = start; m + totalMin <= end; m += gran) {
      const hh = Math.floor(m / 60).toString().padStart(2, "0");
      const mm = (m % 60).toString().padStart(2, "0");
      const iso = `${dateStr}T${hh}:${mm}:00`;
      const slotStart = new Date(iso).getTime();
      const slotEnd = slotStart + totalMin * 60_000;
      if (slotStart < minStart) continue;
      const conflictAppt = taken.some((t) => {
        const ts = new Date(t.starts_at).getTime();
        const te = new Date(t.ends_at).getTime();
        return slotStart < te && slotEnd > ts;
      });
      if (conflictAppt) continue;
      const conflictBlock = blocks.some((b) => {
        const bs = new Date(b.starts_at).getTime();
        const be = new Date(b.ends_at).getTime();
        return slotStart < be && slotEnd > bs;
      });
      if (conflictBlock) continue;
      out.push(`${hh}:${mm}`);
    }
    return out;
  }, [dateStr, hours, taken, blocks, totalMin, minAdvanceMin]);

  const dateOptions = useMemo(() => {
    const list: { iso: string; label: string; wd: number; disabled: boolean }[] = [];
    const today = new Date();
    const maxDays = Math.min(Math.max(maxAdvanceDays, 1), 60);
    const daysToShow = Math.min(14, maxDays);
    for (let i = 0; i < daysToShow; i++) {
      const d = new Date(); d.setDate(today.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const wd = d.getDay();
      const h = resolveHours(wd, hours);
      list.push({
        iso, wd,
        label: `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`,
        disabled: !h,
      });
    }
    return list;
  }, [hours, maxAdvanceDays]);

  const toggleService = (s: Service) => {
    setSelected((prev) => prev.some((x) => x.id === s.id) ? prev.filter((x) => x.id !== s.id) : [...prev, s]);
    setStaff(null); setTimeStr("");
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidating(true);
    try {
      const subtotal = selected.reduce((s, x) => s + x.price_cents, 0);
      const { data, error } = await supabase.rpc("validate_coupon", {
        _company: companyId, _code: couponCode.trim(), _subtotal_cents: subtotal,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || row.message !== "ok") {
        setCoupon(null);
        toast.error(row?.message || "Cupom inválido");
      } else {
        setCoupon({ code: row.code, discount_cents: row.discount_cents, message: row.message });
        toast.success(`Cupom aplicado: -${brl(row.discount_cents / 100)}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally { setValidating(false); }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const iso = `${dateStr}T${timeStr}:00`;
      const { data: s } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (s.session?.access_token) headers.Authorization = `Bearer ${s.session.access_token}`;
      const res = await fetch("/api/public/book", {
        method: "POST",
        headers,
        body: JSON.stringify({
          slug: company.slug,
          service_ids: selected.map((s) => s.id),
          staff_id: staff?.id ?? null,
          starts_at: new Date(iso).toISOString(),
          coupon_code: coupon?.code ?? "",
          customer: form,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao agendar");
      setDone({ starts_at: json.starts_at });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const primary = company.primary_color || "#0f172a";
  const accent = company.secondary_color || "#c9a86a";

  // Navegação entre passos, pulando "Profissional" se desativado no portal
  const goNext = () => {
    setStep((s) => {
      let next = (s + 1) as Step;
      if (next === 2 && !showStaffStep) next = 3;
      if (next > 6) next = 6;
      return next;
    });
  };
  const goPrev = () => {
    setStep((s) => {
      let prev = (s - 1) as Step;
      if (prev === 2 && !showStaffStep) prev = 1;
      if (prev < 1) prev = 1;
      return prev;
    });
  };

  const canContinue = (() => {
    if (step === 1) return selected.length > 0;
    if (step === 2) return true; // "qualquer profissional" é válido
    if (step === 3) return !!dateStr && dateOptions.some((d) => d.iso === dateStr && !d.disabled);
    if (step === 4) return !!timeStr;
    if (step === 5) return !!form.name.trim() && !!form.phone.trim();
    return false;
  })();

  if (done) {
    const d = new Date(done.starts_at);
    const dateLabel = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    const timeLabel = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const servicesLine = selected.map((s) => `• ${s.name}`).join("\n");
    const totalCents = selected.reduce((s, x) => s + x.price_cents, 0) - (coupon?.discount_cents ?? 0);
    const waMsg = encodeURIComponent(
      `✨ Olá, *${company.name}*!\n\n` +
      `✅ Acabei de confirmar meu agendamento pelo site.\n\n` +
      `👤 *Cliente:* ${form.name}\n` +
      `📅 *Data:* ${dateLabel}\n` +
      `🕐 *Horário:* ${timeLabel}\n` +
      (staff ? `💇 *Profissional:* ${staff.name}\n` : "") +
      `\n💅 *Serviços:*\n${servicesLine}\n` +
      `\n💰 *Total:* ${brl(totalCents / 100)}` +
      (coupon ? ` (cupom ${coupon.code})` : "") +
      `\n\n🙏 Aguardo a confirmação. Obrigado(a)!`
    );
    return (
      <div className="min-h-screen bg-background">
        <Hero company={company} primary={primary} accent={accent} slug={company.slug} loggedIn={!!session} />
        <div className="max-w-lg mx-auto p-6">
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full" style={{ background: accent }}>
                <Check className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-2xl font-semibold">Agendamento confirmado!</h2>
              <p className="text-muted-foreground">
                {dateLabel} às {timeLabel}
              </p>
              <div className="flex flex-col gap-2 items-center pt-2">
                {session ? (
                  <Link to="/b/$slug/minha-conta" params={{ slug: company.slug }}>
                    <Button style={{ background: primary }}>Ver meus agendamentos</Button>
                  </Link>
                ) : (
                  <Link to="/b/$slug/entrar" params={{ slug: company.slug }}>
                    <Button style={{ background: primary }}>Criar conta e acompanhar</Button>
                  </Link>
                )}
                {company.whatsapp && (() => {
                  const d = company.whatsapp.replace(/\D/g, "");
                  const p = d.startsWith("55") ? d : `55${d}`;
                  return (
                    <a href={`https://api.whatsapp.com/send?phone=${p}&text=${waMsg}`} target="_blank" rel="noreferrer">
                      <Button style={{ background: "#25D366", color: "white" }}>
                        <Phone className="h-4 w-4 mr-2" /> Enviar confirmação no WhatsApp
                      </Button>
                    </a>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Hero company={company} primary={primary} accent={accent} slug={company.slug} loggedIn={!!session} />
      <div className="max-w-lg mx-auto p-4 md:p-6 space-y-4">
        <Steps step={step} accent={accent} showStaffStep={showStaffStep} />

        {step === 1 && <PortalInfo company={company} hours={hours} primary={primary} accent={accent} />}
        {step === 1 && <GallerySection companyId={companyId} company={company} primary={primary} accent={accent} />}
        {step === 1 && company.show_reviews_on_portal && <ReviewsSection companyId={companyId} accent={accent} />}

        {step === 1 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="font-semibold text-lg">Escolha os serviços</h2>
              {!services.length && <p className="text-sm text-muted-foreground">Nenhum serviço disponível.</p>}
              <div className="space-y-2">
                {services.map((s) => {
                  const active = selected.some((x) => x.id === s.id);
                  return (
                    <button key={s.id} onClick={() => toggleService(s)}
                      className={`w-full text-left rounded-xl border p-3 transition ${active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.duration_min} min{s.category ? ` · ${s.category}` : ""}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{brl(s.price_cents / 100)}</p>
                          {active && <Badge variant="secondary" className="mt-1"><Check className="h-3 w-3 mr-1" /> Selecionado</Badge>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && showStaffStep && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="font-semibold text-lg">Escolha o profissional</h2>
              <button onClick={() => setStaff(null)}
                className={`w-full text-left rounded-xl border p-3 ${!staff ? "border-primary bg-primary/5" : "border-border"}`}>
                <p className="font-medium">Qualquer profissional</p>
                <p className="text-xs text-muted-foreground">Primeiro disponível no horário</p>
              </button>
              {staffList.map((s) => (
                <button key={s.id} onClick={() => setStaff(s)}
                  className={`w-full text-left rounded-xl border p-3 flex items-center gap-3 ${staff?.id === s.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                  {s.photo_url ? (
                    <img src={s.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full grid place-items-center text-white text-sm font-semibold"
                      style={{ background: s.color ?? accent }}>{s.name.charAt(0)}</div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.name}</p>
                    {s.role_title && <p className="text-xs text-muted-foreground truncate">{s.role_title}</p>}
                  </div>
                </button>
              ))}
              {!staffList.length && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nenhum profissional específico — seguir com "Qualquer profissional".
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="font-semibold text-lg">Escolha a data</h2>
              <div>
                <Label className="text-xs mb-2 flex items-center gap-1"><Calendar className="h-3 w-3" /> Data</Label>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {dateOptions.map((d) => (
                    <button key={d.iso} disabled={d.disabled}
                      onClick={() => { setDateStr(d.iso); setTimeStr(""); }}
                      className={`shrink-0 rounded-xl border px-3 py-2 min-w-16 text-center transition ${
                        d.disabled ? "opacity-40 cursor-not-allowed" :
                        dateStr === d.iso ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted/50"
                      }`}>
                      <p className="text-[10px] uppercase tracking-wider">{WEEKDAYS[d.wd]}</p>
                      <p className="font-semibold text-sm">{d.label}</p>
                    </button>
                  ))}
                </div>
                {dateOptions.every((d) => d.disabled) && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Sem datas disponíveis. Entre em contato pelo WhatsApp.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="font-semibold text-lg">Escolha o horário</h2>
              <div>
                <Label className="text-xs mb-2 flex items-center gap-1"><Clock className="h-3 w-3" /> Horário</Label>
                {!slots.length ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Sem horários disponíveis nesta data.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((t) => (
                      <button key={t} onClick={() => setTimeStr(t)}
                        className={`rounded-lg border py-2 text-sm transition ${
                          timeStr === t ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted/50"
                        }`}>{t}</button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="font-semibold text-lg">Seus dados</h2>
              <div><Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>WhatsApp</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" /></div>
              <div><Label>E-mail (opcional)</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Observações (opcional)</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <div>
                <Label>Cupom de desconto (opcional)</Label>
                <div className="flex gap-2">
                  <Input value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCoupon(null); }} placeholder="CODIGO" />
                  <Button type="button" variant="outline" disabled={validating || !couponCode.trim()} onClick={applyCoupon}>
                    {validating ? "…" : coupon ? "OK" : "Aplicar"}
                  </Button>
                </div>
                {coupon && (
                  <p className="text-xs text-green-700 mt-1">Desconto de {brl(coupon.discount_cents / 100)} aplicado.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 6 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="font-semibold text-lg">Confirme seu agendamento</h2>
              <Summary selected={selected} staff={staff} dateStr={dateStr} timeStr={timeStr} totalMin={totalMin} totalPrice={totalPrice} discountCents={coupon?.discount_cents ?? 0} />
              <div className="rounded-xl border p-3 text-sm space-y-1">
                <p className="font-semibold">Contato</p>
                <p className="text-xs text-muted-foreground">{form.name} · {form.phone}{form.email ? ` · ${form.email}` : ""}</p>
                {form.notes && <p className="text-xs text-muted-foreground italic">"{form.notes}"</p>}
              </div>
              <p className="text-xs text-muted-foreground">
                Ao confirmar você aceita as condições de agendamento desta empresa.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 border-t bg-card/90 backdrop-blur p-3">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          {step > 1 && (
            <Button variant="outline" size="lg" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1 text-sm">
            {selected.length > 0 && (
              <>
                <p className="font-semibold">{brl(totalPrice)}</p>
                <p className="text-xs text-muted-foreground">{totalMin} min · {selected.length} serviço(s)</p>
              </>
            )}
          </div>
          {step < 6 ? (
            <Button size="lg" style={{ background: primary }}
              disabled={!canContinue}
              onClick={goNext}>
              Continuar <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="lg" style={{ background: primary }}
              disabled={submitting || !form.name || !form.phone || !timeStr}
              onClick={submit}>
              {submitting ? "Enviando…" : "Confirmar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Hero({ company, primary, accent, slug, loggedIn }: { company: any; primary: string; accent: string; slug: string; loggedIn: boolean }) {
  return (
    <div className="relative" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
      {company.banner_url && (
        <img src={company.banner_url} className="absolute inset-0 h-full w-full object-cover opacity-40" alt="" />
      )}
      <div className="relative max-w-lg mx-auto px-6 py-10 text-white">
        <div className="flex items-start gap-3">
          {company.logo_url ? (
            <img src={company.logo_url} className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white/40" alt="" />
          ) : (
            <div className="h-14 w-14 rounded-2xl grid place-items-center bg-white/15 ring-2 ring-white/40">
              <Sparkles className="h-7 w-7" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold leading-tight truncate">{company.name}</h1>
            {company.address && (
              <p className="text-xs text-white/80 flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" /> {company.address}
              </p>
            )}
          </div>
          <Link
            to={loggedIn ? "/b/$slug/minha-conta" : "/b/$slug/entrar"}
            params={{ slug }}
            className="shrink-0 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur px-3 py-1.5 text-xs font-medium ring-1 ring-white/30 flex items-center gap-1.5"
          >
            <User className="h-3.5 w-3.5" /> {loggedIn ? "Minha conta" : "Entrar"}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Steps({ step, accent, showStaffStep }: { step: number; accent: string; showStaffStep: boolean }) {
  const labels = showStaffStep
    ? ["Serviços", "Profissional", "Data", "Horário", "Dados", "Confirmar"]
    : ["Serviços", "Data", "Horário", "Dados", "Confirmar"];
  // Mapeia o step real (1..6) para o índice visual, pulando "Profissional" quando desativado
  const visualStep = showStaffStep ? step : (step === 1 ? 1 : step - 1);
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => {
        const active = visualStep === i + 1;
        const done = visualStep > i + 1;
        return (
          <div key={l} className="flex-1 flex items-center gap-2">
            <div className={`h-7 w-7 rounded-full grid place-items-center text-xs font-semibold ${
              active ? "text-white" : done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`} style={active ? { background: accent } : undefined}>
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:inline ${active ? "font-semibold" : "text-muted-foreground"}`}>{l}</span>
          </div>
        );
      })}
    </div>
  );
}

function Summary({ selected, staff, dateStr, timeStr, totalMin, totalPrice, discountCents = 0 }: {
  selected: Service[]; staff: Staff | null; dateStr: string; timeStr: string; totalMin: number; totalPrice: number; discountCents?: number;
}) {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : null;
  const final = Math.max(0, totalPrice - discountCents / 100);
  return (
    <div className="rounded-xl bg-muted/40 p-3 text-sm space-y-1">
      <p className="font-semibold">Resumo</p>
      {selected.map((s) => (
        <div key={s.id} className="flex justify-between text-xs">
          <span>{s.name}</span><span>{brl(s.price_cents / 100)}</span>
        </div>
      ))}
      <div className="text-xs text-muted-foreground pt-1">
        {staff ? `Com ${staff.name}` : "Qualquer profissional"} ·{" "}
        {d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}{timeStr ? ` às ${timeStr}` : ""} · {totalMin} min
      </div>
      {discountCents > 0 && (
        <div className="flex justify-between text-xs text-green-700">
          <span>Desconto</span><span>-{brl(discountCents / 100)}</span>
        </div>
      )}
      <div className="flex justify-between font-semibold border-t pt-1 mt-1">
        <span>Total</span><span>{brl(final)}</span>
      </div>
    </div>
  );
}

function PortalInfo({ company, hours, primary, accent }: { company: any; hours: Hours[]; primary: string; accent: string }) {
  const waDigits = (company.whatsapp || "").replace(/\D/g, "");
  const wa = waDigits ? (waDigits.startsWith("55") ? waDigits : `55${waDigits}`) : "";
  const socials = [
    company.instagram_url && { icon: Instagram, url: company.instagram_url, label: "Instagram" },
    company.facebook_url && { icon: Facebook, url: company.facebook_url, label: "Facebook" },
    company.tiktok_url && { icon: MessageCircle, url: company.tiktok_url, label: "TikTok" },
    company.website_url && { icon: Globe, url: company.website_url, label: "Site" },
  ].filter(Boolean) as { icon: any; url: string; label: string }[];
  const orderedHours = [...(hours ?? [])].sort((a, b) => a.weekday - b.weekday);
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {company.welcome_message && (
          <p className="text-sm rounded-lg p-3" style={{ background: `${accent}15`, borderLeft: `3px solid ${accent}` }}>
            {company.welcome_message}
          </p>
        )}
        {company.description && (
          <p className="text-sm text-muted-foreground whitespace-pre-line">{company.description}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {wa && (
            <a
              href={`https://api.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(`✨ Olá, *${company.name}*! 👋\n\nGostaria de mais informações sobre agendamentos. 📅`)}`}
              target="_blank" rel="noreferrer" className="flex-1 min-w-[140px]"
            >
              <Button className="w-full" style={{ background: "#25D366", color: "white" }}>
                <Phone className="h-4 w-4 mr-2" /> Falar no WhatsApp
              </Button>
            </a>
          )}
          {company.phone && (
            <a href={`tel:${company.phone.replace(/\D/g, "")}`} className="flex-1 min-w-[140px]">
              <Button variant="outline" className="w-full"><Phone className="h-4 w-4 mr-2" /> Ligar</Button>
            </a>
          )}
        </div>
        {orderedHours.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Horário</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {orderedHours.map((h) => (
                <div key={h.weekday} className="flex justify-between px-2 py-1 rounded bg-muted/40">
                  <span>{WEEKDAYS[h.weekday]}</span>
                  <span className="text-muted-foreground">
                    {h.closed ? "Fechado" : `${h.start_time?.slice(0, 5)} – ${h.end_time?.slice(0, 5)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {socials.length > 0 && (
          <div className="flex gap-2 pt-1">
            {socials.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer"
                 className="h-9 w-9 rounded-full grid place-items-center border hover:bg-muted"
                 title={s.label} style={{ borderColor: `${primary}33` }}>
                <s.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewsSection({ companyId, accent }: { companyId: string; accent: string }) {
  const { data } = useQuery({
    queryKey: ["pub_reviews", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("reviews")
        .select("id,rating,comment,created_at,customers(name)")
        .eq("company_id", companyId).eq("published", true)
        .order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });
  const reviews = (data ?? []) as any[];
  if (!reviews.length) return null;
  const avg = reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Avaliações</h2>
          <div className="flex items-center gap-1 text-sm">
            <Star className="h-4 w-4 fill-current" style={{ color: accent }} />
            <span className="font-semibold">{avg.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">({reviews.length})</span>
          </div>
        </div>
        <div className="space-y-2">
          {reviews.slice(0, 3).map((r) => (
            <div key={r.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-1 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-current" : ""}`}
                    style={{ color: i < r.rating ? accent : "#ccc" }} />
                ))}
                <span className="text-xs text-muted-foreground ml-1">
                  {r.customers?.name ?? "Cliente"}
                </span>
              </div>
              {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type GalleryPhoto = {
  id: string;
  category: string | null;
  title: string | null;
  description: string | null;
  image_url: string;
  featured: boolean;
  created_at: string;
};

function GallerySection({ companyId, company, primary, accent }: { companyId: string; company: any; primary: string; accent: string }) {
  const { data } = useQuery({
    queryKey: ["pub_gallery", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("gallery_photos" as any)
        .select("id,category,title,description,image_url,featured,created_at")
        .eq("company_id", companyId)
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(60);
      return ((data ?? []) as unknown) as GalleryPhoto[];
    },
  });
  const photos = data ?? [];
  const [cat, setCat] = useState<string>("all");
  const [lightbox, setLightbox] = useState<GalleryPhoto | null>(null);

  if (!photos.length) return null;

  const categories = Array.from(new Set(photos.map((p) => p.category).filter(Boolean))) as string[];
  const visible = cat === "all" ? photos : photos.filter((p) => (p.category ?? "") === cat);
  const wa = (company.whatsapp || "").replace(/\D/g, "");

  const requestQuote = (p: GalleryPhoto) => {
    if (!wa) return;
    const parts = [
      `✨ Olá, *${company.name}*! 👋`,
      ``,
      `Vi este trabalho no site e gostaria de solicitar um orçamento:`,
      p.title ? `📌 *${p.title}*` : null,
      p.category ? `🗂️ Categoria: ${p.category}` : null,
      p.description ? `📝 ${p.description}` : null,
      ``,
      `Pode me passar mais informações? 🙏`,
    ].filter(Boolean).join("\n");
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(parts)}`, "_blank");
  };

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <ImageIcon className="h-4 w-4" style={{ color: accent }} /> Galeria de trabalhos
            </h2>
            <span className="text-xs text-muted-foreground">{photos.length} fotos</span>
          </div>

          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
              <button
                onClick={() => setCat("all")}
                className={`shrink-0 px-3 py-1 rounded-full text-xs border ${cat === "all" ? "text-white border-transparent" : "border-border"}`}
                style={cat === "all" ? { background: primary } : undefined}
              >
                Todas
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs border ${cat === c ? "text-white border-transparent" : "border-border"}`}
                  style={cat === c ? { background: primary } : undefined}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-1.5">
            {visible.slice(0, 24).map((p) => (
              <button
                key={p.id}
                onClick={() => setLightbox(p)}
                className="relative aspect-square overflow-hidden rounded-lg bg-muted group"
              >
                <img src={p.image_url} alt={p.title ?? ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                {p.featured && (
                  <span className="absolute top-1 left-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white flex items-center gap-0.5" style={{ background: accent }}>
                    <Star className="h-2.5 w-2.5 fill-current" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white grid place-items-center hover:bg-white/20"
          >
            <XIcon className="h-5 w-5" />
          </button>
          <div className="max-w-2xl w-full max-h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.image_url} alt={lightbox.title ?? ""} className="w-full max-h-[70vh] object-contain rounded-lg" />
            <div className="bg-card mt-3 rounded-lg p-4 space-y-2">
              {lightbox.title && <p className="font-semibold">{lightbox.title}</p>}
              {lightbox.category && <p className="text-xs text-muted-foreground">{lightbox.category}</p>}
              {lightbox.description && <p className="text-sm text-muted-foreground">{lightbox.description}</p>}
              {wa && (
                <Button
                  className="w-full mt-2"
                  style={{ background: "#25D366", color: "white" }}
                  onClick={() => requestQuote(lightbox)}
                >
                  <MessageCircle className="h-4 w-4 mr-2" /> Solicitar orçamento
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

