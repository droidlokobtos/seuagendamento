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
import { Sparkles, MapPin, Phone, Check, Calendar, Clock, ChevronLeft, ChevronRight, User } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/b/$slug")({
  loader: async ({ params }) => {
    const { data: company, error } = await supabase
      .from("companies")
      .select("id,name,slug,logo_url,banner_url,primary_color,secondary_color,address,whatsapp,phone,status")
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

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function BookingPage() {
  const { company } = Route.useLoaderData();
  const companyId = company.id;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
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
      // Only professionals that provide ALL selected services
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

  const totalMin = selected.reduce((s, x) => s + x.duration_min, 0);
  const totalPrice = selected.reduce((s, x) => s + x.price_cents, 0) / 100;

  const slots = useMemo(() => {
    if (!dateStr || !totalMin) return [] as string[];
    const d = new Date(dateStr + "T00:00:00");
    const wd = d.getDay();
    const h = hours.find((x) => x.weekday === wd);
    if (!h || h.closed) return [];
    const [sh, sm] = h.start_time.split(":").map(Number);
    const [eh, em] = h.end_time.split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    const step = 15;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const out: string[] = [];
    for (let m = start; m + totalMin <= end; m += step) {
      if (isToday && m < nowMin + 10) continue;
      const hh = Math.floor(m / 60).toString().padStart(2, "0");
      const mm = (m % 60).toString().padStart(2, "0");
      const iso = `${dateStr}T${hh}:${mm}:00`;
      const slotStart = new Date(iso).getTime();
      const slotEnd = slotStart + totalMin * 60_000;
      const conflict = taken.some((t) => {
        const ts = new Date(t.starts_at).getTime();
        const te = new Date(t.ends_at).getTime();
        return slotStart < te && slotEnd > ts;
      });
      if (!conflict) out.push(`${hh}:${mm}`);
    }
    return out;
  }, [dateStr, hours, taken, totalMin]);

  const dateOptions = useMemo(() => {
    const list: { iso: string; label: string; wd: number; disabled: boolean }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const wd = d.getDay();
      const h = hours.find((x) => x.weekday === wd);
      list.push({
        iso, wd,
        label: `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`,
        disabled: !h || h.closed,
      });
    }
    return list;
  }, [hours]);

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

  if (done) {
    const d = new Date(done.starts_at);
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
                {d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} às{" "}
                {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
              {company.whatsapp && (
                <a href={`https://wa.me/${company.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="mt-2"><Phone className="h-4 w-4 mr-2" /> Falar no WhatsApp</Button>
                </a>
              )}
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
        <Steps step={step} accent={accent} />

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

        {step === 2 && (
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
              <h2 className="font-semibold text-lg">Escolha data e horário</h2>
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
              </div>
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

        {step === 4 && (
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
              <Summary selected={selected} staff={staff} dateStr={dateStr} timeStr={timeStr} totalMin={totalMin} totalPrice={totalPrice} discountCents={coupon?.discount_cents ?? 0} />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 border-t bg-card/90 backdrop-blur p-3">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          {step > 1 && (
            <Button variant="outline" size="lg" onClick={() => setStep((s) => (s - 1) as any)}>
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
          {step < 4 ? (
            <Button size="lg" style={{ background: primary }}
              disabled={step === 1 && !selected.length}
              onClick={() => setStep((s) => (s + 1) as any)}>
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

function Hero({ company, primary, accent }: { company: any; primary: string; accent: string }) {
  return (
    <div className="relative" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
      {company.banner_url && (
        <img src={company.banner_url} className="absolute inset-0 h-full w-full object-cover opacity-40" alt="" />
      )}
      <div className="relative max-w-lg mx-auto px-6 py-10 text-white">
        <div className="flex items-center gap-3">
          {company.logo_url ? (
            <img src={company.logo_url} className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white/40" alt="" />
          ) : (
            <div className="h-14 w-14 rounded-2xl grid place-items-center bg-white/15 ring-2 ring-white/40">
              <Sparkles className="h-7 w-7" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold leading-tight">{company.name}</h1>
            {company.address && (
              <p className="text-xs text-white/80 flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" /> {company.address}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Steps({ step, accent }: { step: number; accent: string }) {
  const labels = ["Serviços", "Profissional", "Horário", "Contato"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => {
        const active = step === i + 1;
        const done = step > i + 1;
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
