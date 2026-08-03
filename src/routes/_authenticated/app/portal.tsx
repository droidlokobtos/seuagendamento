import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
import { toast } from "sonner";
import { Palette, Sparkles, MapPin, Clock, ExternalLink } from "lucide-react";
import { BG_STYLES, CARD_STYLES, HIGHLIGHTS, portalTheme, heroBackground, heroImageOpacity, heroTextClass, highlightStyle } from "@/lib/portal-theme";

export const Route = createFileRoute("/_authenticated/app/portal")({
  component: PortalCustomizePage,
  head: () => ({
    meta: [
      { title: "Personalizar página de agendamento" },
      { name: "description", content: "Defina cores, imagem de fundo, logotipo e slogan da sua página pública de agendamento." },
      { property: "og:title", content: "Personalizar página de agendamento" },
      { property: "og:description", content: "Identidade visual própria para o seu link de agendamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Form = {
  logo_url: string | null;
  portal_bg_url: string | null;
  portal_bg_style: string;
  primary_color: string;
  secondary_color: string;
  portal_button_color: string;
  portal_text_color: string;
  portal_card_style: string;
  portal_highlight: string;
  portal_slogan: string;
  welcome_message: string;
};

const DEFAULTS: Form = {
  logo_url: null,
  portal_bg_url: null,
  portal_bg_style: "gradient",
  primary_color: "#0f172a",
  secondary_color: "#c9a86a",
  portal_button_color: "#0f172a",
  portal_text_color: "#0f172a",
  portal_card_style: "card",
  portal_highlight: "soft",
  portal_slogan: "",
  welcome_message: "",
};

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
          aria-label={label}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
      </div>
    </div>
  );
}

function OptionGroup({
  options,
  value,
  onChange,
}: {
  options: readonly { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            value === o.key
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PortalCustomizePage() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const [form, setForm] = useState<Form>(DEFAULTS);

  const { data: company } = useQuery({
    queryKey: ["company-full", companyId],
    queryFn: async () => (await supabase.from("companies").select("*").eq("id", companyId).single()).data,
  });

  useEffect(() => {
    if (!company) return;
    const c: any = company;
    setForm({
      logo_url: c.logo_url ?? null,
      portal_bg_url: c.portal_bg_url ?? null,
      portal_bg_style: c.portal_bg_style ?? "gradient",
      primary_color: c.primary_color ?? DEFAULTS.primary_color,
      secondary_color: c.secondary_color ?? DEFAULTS.secondary_color,
      portal_button_color: c.portal_button_color ?? c.primary_color ?? DEFAULTS.primary_color,
      portal_text_color: c.portal_text_color ?? DEFAULTS.portal_text_color,
      portal_card_style: c.portal_card_style ?? "card",
      portal_highlight: c.portal_highlight ?? "soft",
      portal_slogan: c.portal_slogan ?? "",
      welcome_message: c.welcome_message ?? "",
    });
  }, [company]);

  const { data: gallery = [] } = useQuery({
    queryKey: ["portal-gallery", companyId],
    queryFn: async () =>
      (await supabase
        .from("gallery_photos")
        .select("id,photo_url")
        .eq("company_id", companyId)
        .limit(24)).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("companies")
        .update({
          logo_url: form.logo_url,
          portal_bg_url: form.portal_bg_url,
          portal_bg_style: form.portal_bg_style,
          primary_color: form.primary_color,
          secondary_color: form.secondary_color,
          portal_button_color: form.portal_button_color,
          portal_text_color: form.portal_text_color,
          portal_card_style: form.portal_card_style,
          portal_highlight: form.portal_highlight,
          portal_slogan: form.portal_slogan || null,
          welcome_message: form.welcome_message || null,
        } as any)
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Personalização publicada");
      qc.invalidateQueries({ queryKey: ["company-full", companyId] });
      qc.invalidateQueries({ queryKey: ["my-companies"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const theme = portalTheme({ ...(company as any), ...form });
  const publicUrl =
    typeof window !== "undefined" && (company as any)?.slug
      ? `${window.location.origin}/b/${(company as any).slug}`
      : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" /> Personalizar página de agendamento
          </h1>
          <p className="text-sm text-muted-foreground">
            Deixe seu link com a identidade visual da sua marca. As alterações aparecem no preview antes de publicar.
          </p>
        </div>
        {publicUrl && (
          <Button variant="outline" onClick={() => window.open(publicUrl, "_blank")}>
            <ExternalLink className="h-4 w-4 mr-2" /> Ver página
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] items-start">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold">Marca</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Logotipo</Label>
                  <ImageUpload
                    value={form.logo_url}
                    onChange={(url) => setForm((f) => ({ ...f, logo_url: url }))}
                    folder="logos"
                    preset="logo"
                    label="Enviar logotipo"
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <Label>Slogan / mensagem de destaque</Label>
                    <Input
                      value={form.portal_slogan}
                      onChange={(e) => setForm((f) => ({ ...f, portal_slogan: e.target.value }))}
                      placeholder="Ex.: Estilo e precisão em cada corte"
                      maxLength={90}
                    />
                  </div>
                  <div>
                    <Label>Mensagem de apresentação</Label>
                    <Textarea
                      rows={3}
                      value={form.welcome_message}
                      onChange={(e) => setForm((f) => ({ ...f, welcome_message: e.target.value }))}
                      placeholder="Boas-vindas exibidas na página pública"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold">Fundo da página</h2>
              <OptionGroup
                options={BG_STYLES}
                value={form.portal_bg_style}
                onChange={(v) => setForm((f) => ({ ...f, portal_bg_style: v }))}
              />
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Imagem própria (capa)</Label>
                  <ImageUpload
                    value={form.portal_bg_url}
                    onChange={(url) => setForm((f) => ({ ...f, portal_bg_url: url }))}
                    folder="banners"
                    aspect="wide"
                    preset="banner"
                    label="Enviar imagem de fundo"
                  />
                </div>
                <div>
                  <Label>Escolher da galeria</Label>
                  {gallery.length === 0 ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Nenhuma foto na galeria ainda. Adicione trabalhos em Serviços → Galeria.
                    </p>
                  ) : (
                    <div className="mt-1 grid grid-cols-4 gap-2">
                      {(gallery as any[]).map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, portal_bg_url: g.photo_url, portal_bg_style: "image" }))}
                          className={`aspect-square overflow-hidden rounded-lg border-2 ${
                            form.portal_bg_url === g.photo_url ? "border-primary" : "border-transparent"
                          }`}
                        >
                          <img src={g.photo_url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold">Cores e destaques</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <ColorField label="Cor principal" value={form.primary_color} onChange={(v) => setForm((f) => ({ ...f, primary_color: v }))} />
                <ColorField label="Cor de destaque" value={form.secondary_color} onChange={(v) => setForm((f) => ({ ...f, secondary_color: v }))} />
                <ColorField label="Cor dos botões" value={form.portal_button_color} onChange={(v) => setForm((f) => ({ ...f, portal_button_color: v }))} />
                <ColorField label="Cor dos textos" value={form.portal_text_color} onChange={(v) => setForm((f) => ({ ...f, portal_text_color: v }))} />
              </div>
              <div>
                <Label>Estilo de destaque</Label>
                <OptionGroup
                  options={HIGHLIGHTS}
                  value={form.portal_highlight}
                  onChange={(v) => setForm((f) => ({ ...f, portal_highlight: v }))}
                />
              </div>
              <div>
                <Label>Aparência dos cards de serviços</Label>
                <OptionGroup
                  options={CARD_STYLES}
                  value={form.portal_card_style}
                  onChange={(v) => setForm((f) => ({ ...f, portal_card_style: v }))}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Publicando..." : "Publicar alterações"}
            </Button>
            <Button variant="outline" onClick={() => company && setForm({ ...form, ...DEFAULTS })}>
              Restaurar padrão
            </Button>
          </div>
        </div>

        {/* Pré-visualização em tempo real */}
        <div className="lg:sticky lg:top-24">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pré-visualização
          </p>
          <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[28px] border-4 border-foreground/10 bg-background shadow-xl">
            <div className="relative" style={heroBackground(theme)}>
              {theme.bgUrl && (
                <img
                  src={theme.bgUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ opacity: heroImageOpacity(theme) }}
                />
              )}
              <div className={`relative px-5 py-6 ${heroTextClass(theme)}`}>
                <div className="flex items-center gap-3">
                  {form.logo_url ? (
                    <img src={form.logo_url} className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white/40" alt="" />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-2 ring-white/40">
                      <Sparkles className="h-6 w-6" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{activeCompany?.name}</p>
                    {theme.slogan && <p className="truncate text-xs opacity-80">{theme.slogan}</p>}
                  </div>
                </div>
                <p className="mt-3 flex items-center gap-1 text-[11px] opacity-80">
                  <MapPin className="h-3 w-3" /> {(company as any)?.address ?? "Endereço da empresa"}
                </p>
              </div>
            </div>
            <div className="space-y-3 p-4" style={{ color: theme.text }}>
              {form.welcome_message && (
                <p
                  className="rounded-lg p-2.5 text-xs"
                  style={{ background: `${theme.accent}15`, borderLeft: `3px solid ${theme.accent}` }}
                >
                  {form.welcome_message}
                </p>
              )}
              <span className="inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium" style={highlightStyle(theme)}>
                Agendamento online
              </span>
              {[
                { n: "Corte masculino", d: 45, p: "R$ 60,00" },
                { n: "Barba completa", d: 30, p: "R$ 40,00" },
              ].map((s) => (
                <div
                  key={s.n}
                  className={
                    theme.cardStyle === "minimal"
                      ? "flex items-center justify-between border-b py-2"
                      : "flex items-center justify-between rounded-xl border p-3 shadow-sm"
                  }
                  style={theme.cardStyle === "minimal" ? undefined : { borderColor: `${theme.accent}40` }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {theme.cardStyle === "photo" && (
                      <div className="h-10 w-10 shrink-0 rounded-lg" style={{ background: `${theme.accent}30` }} />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.n}</p>
                      <p className="flex items-center gap-1 text-[11px] opacity-70">
                        <Clock className="h-3 w-3" /> {s.d} min
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: theme.accent }}>
                    {s.p}
                  </span>
                </div>
              ))}
              <button
                type="button"
                className="w-full rounded-lg py-2.5 text-sm font-semibold text-white"
                style={{ background: theme.button }}
              >
                Agendar horário
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
