import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Star, Eye, EyeOff, Trash2, Copy, MessageCircle, RefreshCw, AlertTriangle, TrendingUp, Users, Link2, QrCode, Download, Award,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  DEFAULT_REVIEW_TEMPLATE,
  REVIEW_INVITE_STATUS,
  NEGATIVE_ALERT_MAX_RATING,
  DEFAULT_REVIEW_EXPIRATION_DAYS,
  reviewToken,
} from "@/lib/reviews";


export const Route = createFileRoute("/_authenticated/app/reviews")({ component: Reviews });

type R = {
  id: string; rating: number; comment: string | null; published: boolean; created_at: string;
  customer_id: string | null; appointment_id: string | null; staff_id: string | null;
  staff_rating: number | null; would_return: boolean | null; would_recommend: boolean | null;
  service_names: string | null; source: string | null;
};

type Invite = {
  id: string; token: string; status: string; channel: string | null; message: string | null;
  send_url: string | null; sent_at: string | null; last_sent_at: string | null; rating: number | null;
  responded_at: string | null; expires_at: string; created_at: string;
  customer_id: string | null; staff_id: string | null; appointment_id: string;
};

function Reviews() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id;

  const { data = [] } = useQuery({
    queryKey: ["reviews", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("*")
        .eq("company_id", companyId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as R[];
    },
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["review-invites", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("review_invites").select("*")
        .eq("company_id", companyId!).order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data as unknown as Invite[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["reviews-customers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id,name,phone").eq("company_id", companyId!);
      return (data ?? []) as { id: string; name: string; phone: string | null }[];
    },
  });
  const custMap = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c])), [customers]);

  const { data: staff = [] } = useQuery({
    queryKey: ["reviews-staff", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("staff").select("id,name").eq("company_id", companyId!);
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const staffMap = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s.name])), [staff]);

  const avg = data.length ? data.reduce((a, r) => a + r.rating, 0) / data.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: data.filter((r) => r.rating === n).length }));
  const negatives = data.filter((r) => r.rating <= NEGATIVE_ALERT_MAX_RATING);
  const answered = invites.filter((i) => i.status === "answered").length;
  const sent = invites.filter((i) => i.status !== "pending").length;
  const responseRate = sent ? Math.round((answered / sent) * 100) : 0;
  const recommend = data.filter((r) => r.would_recommend !== null);
  const recommendRate = recommend.length
    ? Math.round((recommend.filter((r) => r.would_recommend).length / recommend.length) * 100)
    : null;

  const byStaff = useMemo(() => {
    const map = new Map<string, { total: number; sum: number }>();
    for (const r of data) {
      if (!r.staff_id) continue;
      const cur = map.get(r.staff_id) ?? { total: 0, sum: 0 };
      cur.total++;
      cur.sum += r.staff_rating ?? r.rating;
      map.set(r.staff_id, cur);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, name: staffMap[id] ?? "Profissional", total: v.total, avg: v.sum / v.total }))
      .sort((a, b) => b.avg - a.avg);
  }, [data, staffMap]);

  const byMonth = useMemo(() => {
    const map = new Map<string, { total: number; sum: number }>();
    for (const r of data) {
      const key = r.created_at.slice(0, 7);
      const cur = map.get(key) ?? { total: 0, sum: 0 };
      cur.total++; cur.sum += r.rating;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([k, v]) => ({ month: k, total: v.total, avg: v.sum / v.total }));
  }, [data]);

  const toggle = useMutation({
    mutationFn: async (r: R) => {
      const { error } = await supabase.from("reviews").update({ published: !r.published }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("reviews").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reviews"] }); toast.success("Removida"); },
  });

  const resend = useMutation({
    mutationFn: async (i: Invite) => {
      const { error } = await supabase.from("review_invites")
        .update({ status: "pending", last_sent_at: new Date().toISOString() }).eq("id", i.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["review-invites"] });
      toast.success("Convite marcado para reenvio");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Avaliações</h1>
          <p className="text-sm text-muted-foreground">Link próprio de avaliação enviado automaticamente após cada atendimento concluído.</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold flex items-center gap-1 justify-end">{avg.toFixed(1)}<Star className="h-6 w-6 fill-primary text-primary" /></div>
          <div className="text-xs text-muted-foreground">{data.length} avaliações</div>
        </div>
      </div>

      <Tabs defaultValue="panel">
        <TabsList>
          <TabsTrigger value="panel">Painel</TabsTrigger>
          <TabsTrigger value="list">Avaliações</TabsTrigger>
          <TabsTrigger value="invites">Convites</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="panel" className="space-y-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={Star} label="Nota média" value={avg ? avg.toFixed(1) : "—"} />
            <Kpi icon={Link2} label="Taxa de resposta" value={`${responseRate}%`} hint={`${answered} de ${sent} enviados`} />
            <Kpi icon={TrendingUp} label="Recomendariam" value={recommendRate === null ? "—" : `${recommendRate}%`} />
            <Kpi icon={AlertTriangle} label="Negativas (≤3★)" value={String(negatives.length)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Distribuição das notas</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {dist.map((d) => (
                  <div key={d.n} className="flex items-center gap-3">
                    <span className="w-10 text-sm flex items-center gap-1">{d.n}<Star className="h-3 w-3 fill-primary text-primary" /></span>
                    <Progress value={data.length ? (d.count / data.length) * 100 : 0} className="h-2 flex-1" />
                    <span className="w-8 text-right text-sm text-muted-foreground">{d.count}</span>
                  </div>
                ))}
                {data.length === 0 && <p className="text-sm text-muted-foreground">Sem avaliações ainda.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Nota por profissional</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {byStaff.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span>{s.name}</span>
                    <span className="flex items-center gap-1 font-medium">
                      {s.avg.toFixed(1)}<Star className="h-3 w-3 fill-primary text-primary" />
                      <span className="text-muted-foreground font-normal">({s.total})</span>
                    </span>
                  </div>
                ))}
                {byStaff.length === 0 && <p className="text-sm text-muted-foreground">Sem dados por profissional.</p>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Evolução mensal</CardTitle></CardHeader>
            <CardContent>
              {byMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem histórico ainda.</p>
              ) : (
                <div className="flex items-end gap-4 h-32">
                  {byMonth.map((m) => (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-medium">{m.avg.toFixed(1)}</span>
                      <div className="w-full rounded-t bg-primary/70" style={{ height: `${(m.avg / 5) * 100}%` }} />
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(`${m.month}-01T00:00:00`).toLocaleDateString("pt-BR", { month: "short" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="pt-4">
          <div className="grid gap-3">
            {data.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
                        ))}
                        {!r.published && <Badge variant="secondary" className="ml-2">Oculta</Badge>}
                        {r.rating <= NEGATIVE_ALERT_MAX_RATING && (
                          <Badge className="ml-1 bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30">Atenção</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {r.customer_id ? custMap[r.customer_id]?.name ?? "Cliente" : "Anônimo"} ·{" "}
                        {new Date(r.created_at).toLocaleDateString("pt-BR")}
                        {r.staff_id ? ` · ${staffMap[r.staff_id] ?? "Profissional"}` : ""}
                        {r.service_names ? ` · ${r.service_names}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => toggle.mutate(r)} title={r.published ? "Ocultar" : "Publicar"}>
                        {r.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  {r.comment && <p className="text-sm">"{r.comment}"</p>}
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {r.staff_rating != null && <span>Profissional: {r.staff_rating}★</span>}
                    {r.would_return != null && <span>Voltaria: {r.would_return ? "sim" : "não"}</span>}
                    {r.would_recommend != null && <span>Recomenda: {r.would_recommend ? "sim" : "não"}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
            {data.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma avaliação ainda. Os convites são gerados automaticamente ao concluir um atendimento.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="invites" className="pt-4">
          <div className="grid gap-2">
            {invites.map((i) => {
              const meta = REVIEW_INVITE_STATUS[i.status] ?? REVIEW_INVITE_STATUS.pending;
              const cust = i.customer_id ? custMap[i.customer_id] : null;
              const link = `${typeof window !== "undefined" ? window.location.origin : ""}/avaliacao/${i.token}`;
              return (
                <Card key={i.id}>
                  <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{cust?.name ?? "Cliente"}</span>
                        <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
                        {i.rating != null && <span className="text-sm">{i.rating}★</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Criado {new Date(i.created_at).toLocaleDateString("pt-BR")} · válido até{" "}
                        {new Date(i.expires_at).toLocaleDateString("pt-BR")}
                        {i.staff_id ? ` · ${staffMap[i.staff_id] ?? "Profissional"}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(link); toast.success("Link copiado"); }}>
                        <Copy className="h-4 w-4 mr-1" /> Link
                      </Button>
                      {i.send_url && (
                        <Button size="sm" variant="outline" onClick={() => window.open(i.send_url!, "_blank", "noopener")}>
                          <MessageCircle className="h-4 w-4 mr-1" /> Enviar
                        </Button>
                      )}
                      {i.status !== "answered" && (
                        <Button size="sm" variant="ghost" onClick={() => resend.mutate(i)} title="Reenviar">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {invites.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum convite gerado ainda.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="pt-4">
          <ReviewSettings companyId={companyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" /> {label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function ReviewSettings({ companyId }: { companyId?: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["review-settings", companyId],
    enabled: !!companyId,
    queryFn: async () =>
      (await supabase.from("review_settings").select("*").eq("company_id", companyId!).maybeSingle()).data,
  });

  const [googleUrl, setGoogleUrl] = useState("");
  const [days, setDays] = useState(String(DEFAULT_REVIEW_EXPIRATION_DAYS));
  const [auto, setAuto] = useState(true);
  const [channels, setChannels] = useState<string[]>(["whatsapp"]);
  const [template, setTemplate] = useState(DEFAULT_REVIEW_TEMPLATE);

  useEffect(() => {
    if (!data) return;
    setGoogleUrl(data.google_review_url ?? "");
    setDays(String(data.expiration_days ?? DEFAULT_REVIEW_EXPIRATION_DAYS));
    setAuto(data.auto_send_enabled ?? true);
    setChannels(data.active_channels ?? ["whatsapp"]);
    setTemplate(data.message_template || DEFAULT_REVIEW_TEMPLATE);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (googleUrl && !/^https?:\/\//i.test(googleUrl)) throw new Error("O link do Google deve começar com https://");
      const n = Number(days);
      if (!Number.isFinite(n) || n < 1 || n > 365) throw new Error("Validade deve ser entre 1 e 365 dias");
      const { error } = await supabase.from("review_settings").upsert({
        company_id: companyId!,
        google_review_url: googleUrl || null,
        expiration_days: n,
        auto_send_enabled: auto,
        active_channels: channels.length ? channels : ["whatsapp"],
        message_template: template,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Configurações salvas"); qc.invalidateQueries({ queryKey: ["review-settings"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const toggleChannel = (id: string) =>
    setChannels((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="text-base">Envio automático</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enviar convite após atendimento concluído</Label>
              <p className="text-xs text-muted-foreground">O link é gerado automaticamente e é de uso único.</p>
            </div>
            <Switch checked={auto} onCheckedChange={setAuto} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[{ id: "whatsapp", label: "WhatsApp" }, { id: "sms", label: "SMS" }, { id: "email", label: "E-mail" }].map((c) => (
              <Button key={c.id} type="button" size="sm" variant={channels.includes(c.id) ? "default" : "outline"} onClick={() => toggleChannel(c.id)}>
                {c.label}
              </Button>
            ))}
          </div>
          <div>
            <Label>Validade do link (dias)</Label>
            <Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} className="max-w-32" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Avaliação no Google</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Label>Link do seu perfil no Google</Label>
          <Input value={googleUrl} onChange={(e) => setGoogleUrl(e.target.value)} placeholder="https://g.page/r/..." />
          <p className="text-xs text-muted-foreground">
            Clientes que avaliarem com 4 ou 5 estrelas serão convidados a repetir a avaliação no Google.
            Notas até {NEGATIVE_ALERT_MAX_RATING}★ ficam internas e geram alerta para a equipe.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Mensagem</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea rows={10} value={template} onChange={(e) => setTemplate(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Variáveis: {"{{NomeCliente}}"} {"{{Empresa}}"} {"{{Data}}"} {"{{Servico}}"} {"{{Funcionario}}"} {"{{LinkAvaliacao}}"}
          </p>
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
