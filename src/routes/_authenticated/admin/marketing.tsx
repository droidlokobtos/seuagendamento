import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import {
  Download,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { generateAdminMarketingImage } from "@/lib/admin-marketing.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/marketing")({
  component: MarketingStudio,
  head: () => ({
    meta: [
      { title: "Marketing e publicidade | Admin Master" },
      { name: "description", content: "Estúdio de campanhas do SeuAgendamento." },
    ],
  }),
});

type Theme = "features" | "practicality" | "plans" | "referral" | "custom";
type Format = "square" | "story";
type CreativeStyle = "impact" | "editorial" | "product" | "human";
type Audience = "multi" | "salon" | "barber" | "aesthetic" | "wellness";
type Quality = "premium" | "fast";
const CAMPAIGNS: Record<
  Theme,
  { label: string; eyebrow: string; title: string; subtitle: string; caption: string; cta: string }
> = {
  features: {
    label: "Funcionalidades",
    eyebrow: "CHEGA DE GESTÃO ESPALHADA",
    title: "Sua empresa inteira sob controle.",
    subtitle: "Agenda, equipe, clientes e financeiro conectados para você decidir melhor.",
    caption:
      "Planilha de um lado, mensagens do outro e informações que nunca batem? Centralize agenda, clientes, equipe e financeiro no SeuAgendamento. Mais controle para decidir. Mais tempo para crescer.",
    cta: "CONHEÇA A PLATAFORMA",
  },
  practicality: {
    label: "Praticidade",
    eyebrow: "TEMPO É FATURAMENTO",
    title: "Menos improviso. Mais crescimento.",
    subtitle: "Organize o dia, acompanhe resultados e atenda melhor sem ficar preso à gestão.",
    caption:
      "Sua empresa não pode depender de memória, papel e conversa perdida. O SeuAgendamento organiza a rotina para você focar no que gera resultado: atender bem e crescer.",
    cta: "SIMPLIFIQUE SUA GESTÃO",
  },
  plans: {
    label: "Planos",
    eyebrow: "CRESÇA NO SEU RITMO",
    title: "Seu negócio evolui. Seu plano acompanha.",
    subtitle: "Escolha 1, 3, 6 ou 12 meses e avance com a estrutura certa para cada fase.",
    caption:
      "Não pague por complexidade que você ainda não precisa — nem fique limitado quando crescer. Escolha o plano e o ciclo ideais para o momento da sua empresa.",
    cta: "COMPARE OS PLANOS",
  },
  referral: {
    label: "Plano de indicação",
    eyebrow: "SUA REDE VALE DINHEIRO",
    title: "Indicação boa reduz sua fatura.",
    subtitle: "Ganhe 2%, 5% ou 10% quando a empresa indicada pagar o primeiro plano.",
    caption:
      "Indique uma empresa para o SeuAgendamento. Quando ela pagar o primeiro plano, você ganha desconto: 2% no Básico, 5% no Business ou 10% no Pro. Indicações extras viram benefícios nos meses seguintes.",
    cta: "INDIQUE AGORA",
  },
  custom: {
    label: "Campanha personalizada",
    eyebrow: "SEUAGENDAMENTO",
    title: "Gestão que acompanha o seu crescimento.",
    subtitle: "Tecnologia prática para empresas que querem ir mais longe.",
    caption: "Transforme a gestão da sua empresa com o SeuAgendamento.",
    cta: "COMECE AGORA",
  },
};

const CREATIVE_STYLES: Record<CreativeStyle, string> = {
  impact: "Impacto e conversão",
  editorial: "Editorial premium",
  product: "Tecnologia e produto",
  human: "Humano e autêntico",
};

const AUDIENCES: Record<Audience, string> = {
  multi: "Todos os negócios",
  salon: "Salões de beleza",
  barber: "Barbearias",
  aesthetic: "Estética",
  wellness: "Bem-estar",
};

function MarketingStudio() {
  const generate = useServerFn(generateAdminMarketingImage);
  const [theme, setTheme] = useState<Theme>("features");
  const [format, setFormat] = useState<Format>("square");
  const [style, setStyle] = useState<CreativeStyle>("impact");
  const [audience, setAudience] = useState<Audience>("multi");
  const [quality, setQuality] = useState<Quality>("premium");
  const [title, setTitle] = useState(CAMPAIGNS.features.title);
  const [subtitle, setSubtitle] = useState(CAMPAIGNS.features.subtitle);
  const [cta, setCta] = useState(CAMPAIGNS.features.cta);
  const [direction, setDirection] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const campaign = CAMPAIGNS[theme];
  const ratio = format === "story" ? "aspect-[9/16]" : "aspect-square";
  const canvasSize = useMemo(() => (format === "story" ? [1080, 1920] : [1080, 1080]), [format]);

  const changeTheme = (value: Theme) => {
    setTheme(value);
    setTitle(CAMPAIGNS[value].title);
    setSubtitle(CAMPAIGNS[value].subtitle);
    setCta(CAMPAIGNS[value].cta);
    setImage(null);
  };
  const create = async () => {
    setLoading(true);
    try {
      const result = await generate({
        data: { theme, format, style, audience, quality, title, subtitle, direction },
      });
      setImage(result.image);
      toast.success("Arte criada com a identidade do SeuAgendamento");
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível gerar a arte");
    } finally {
      setLoading(false);
    }
  };
  const download = async () => {
    if (!image) return;
    const [width, height] = canvasSize;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const bg = new Image();
    bg.crossOrigin = "anonymous";
    bg.src = image;
    await new Promise<void>((resolve, reject) => {
      bg.onload = () => resolve();
      bg.onerror = reject;
    });
    ctx.drawImage(bg, 0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, height, 0, height * 0.18);
    gradient.addColorStop(0, "rgba(24,14,11,.94)");
    gradient.addColorStop(1, "rgba(24,14,11,.02)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    const pad = Math.round(width * 0.075);
    const baseY = height - Math.round(height * 0.1);
    ctx.fillStyle = "#C9A86A";
    ctx.font = `700 ${Math.round(width * 0.025)}px Arial`;
    ctx.fillText(campaign.eyebrow, pad, baseY - Math.round(width * 0.25));
    const drawLines = (
      text: string,
      y: number,
      size: number,
      maxWidth: number,
      lineHeight: number,
    ) => {
      const words = text.split(" ");
      let line = "";
      const lines: string[] = [];
      for (const word of words) {
        const test = `${line}${word} `;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line.trim());
          line = `${word} `;
        } else line = test;
      }
      lines.push(line.trim());
      lines.forEach((value, index) => ctx.fillText(value, pad, y + index * lineHeight));
      return y + lines.length * lineHeight;
    };
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 ${Math.round(width * 0.065)}px Arial`;
    const afterTitle = drawLines(
      title,
      baseY - Math.round(width * 0.19),
      Math.round(width * 0.065),
      width - pad * 2,
      Math.round(width * 0.075),
    );
    ctx.fillStyle = "#F5EEE8";
    ctx.font = `400 ${Math.round(width * 0.03)}px Arial`;
    const afterSubtitle = drawLines(
      subtitle,
      afterTitle + Math.round(width * 0.018),
      Math.round(width * 0.03),
      width - pad * 2,
      Math.round(width * 0.042),
    );
    ctx.font = `700 ${Math.round(width * 0.022)}px Arial`;
    const ctaWidth = ctx.measureText(cta).width + Math.round(width * 0.05);
    const ctaHeight = Math.round(width * 0.055);
    const ctaY = Math.min(
      afterSubtitle + Math.round(width * 0.025),
      height - Math.round(width * 0.12),
    );
    ctx.fillStyle = "#C9A86A";
    ctx.beginPath();
    ctx.roundRect(pad, ctaY, ctaWidth, ctaHeight, ctaHeight / 2);
    ctx.fill();
    ctx.fillStyle = "#241713";
    ctx.textAlign = "left";
    ctx.fillText(cta, pad + Math.round(width * 0.025), ctaY + Math.round(ctaHeight * 0.67));
    ctx.fillStyle = "#C9A86A";
    ctx.font = `700 ${Math.round(width * 0.025)}px Arial`;
    ctx.textAlign = "right";
    ctx.fillText("SEUAGENDAMENTO", width - pad, height - Math.round(width * 0.045));
    const link = document.createElement("a");
    link.download = `seuagendamento-${theme}-${format}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">
          Estúdio de criação
        </p>
        <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Megaphone className="h-6 w-6" />
          Marketing e publicidade
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie peças profissionais com a mesma linguagem visual do SeuAgendamento.
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configurar campanha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Tema da campanha</Label>
              <Select value={theme} onValueChange={(v) => changeTheme(v as Theme)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CAMPAIGNS).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Formato</Label>
              <Select
                value={format}
                onValueChange={(v) => {
                  setFormat(v as Format);
                  setImage(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Post quadrado · 1080 × 1080</SelectItem>
                  <SelectItem value="story">Story · 1080 × 1920</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Direção visual</Label>
                <Select
                  value={style}
                  onValueChange={(v) => {
                    setStyle(v as CreativeStyle);
                    setImage(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CREATIVE_STYLES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Público</Label>
                <Select
                  value={audience}
                  onValueChange={(v) => {
                    setAudience(v as Audience);
                    setImage(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUDIENCES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Qualidade da geração</Label>
              <Select
                value={quality}
                onValueChange={(v) => {
                  setQuality(v as Quality);
                  setImage(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="premium">Premium · GPT Image 2</SelectItem>
                  <SelectItem value="fast">Rascunho rápido · Mini</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Premium entrega maior realismo, direção de arte e acabamento.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={title} maxLength={90} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Texto de apoio</Label>
              <Textarea
                value={subtitle}
                rows={3}
                maxLength={150}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Chamada para ação</Label>
              <Input
                value={cta}
                maxLength={36}
                onChange={(e) => setCta(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-2">
              <Label>Orientação adicional para a IA</Label>
              <Textarea
                value={direction}
                rows={3}
                maxLength={500}
                onChange={(e) => setDirection(e.target.value)}
                placeholder="Opcional: pessoas, ambiente ou clima desejado"
              />
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs font-medium">Identidade protegida</p>
              <div className="mt-3 flex gap-2">
                {["#241713", "#C9A86A", "#FBF8F3"].map((c) => (
                  <span
                    key={c}
                    className="h-7 flex-1 rounded-md border"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Cores, acabamento e assinatura são aplicados automaticamente.
              </p>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={create}
              disabled={loading || title.trim().length < 3 || subtitle.trim().length < 3}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {quality === "premium" ? "Criando campanha premium…" : "Criando rascunho…"}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar com IA Lovable
                </>
              )}
            </Button>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Pré-visualização</CardTitle>
              {image && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={create}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Nova versão
                  </Button>
                  <Button size="sm" onClick={download}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar PNG
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div
                ref={previewRef}
                className={`relative mx-auto w-full max-w-[620px] overflow-hidden rounded-2xl border bg-[#241713] shadow-2xl ${ratio}`}
              >
                {image ? (
                  <img
                    src={image}
                    alt="Fundo criado pela IA"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_70%_20%,rgba(201,168,106,.28),transparent_32%),linear-gradient(145deg,#2b1b16,#120c0a)]">
                    <div className="text-center text-[#FBF8F3]/60">
                      <ImageIcon className="mx-auto h-10 w-10" />
                      <p className="mt-3 text-sm">Sua arte aparecerá aqui</p>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#180e0b]/95 via-[#180e0b]/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-[7.5%] text-white">
                  <p className="text-[clamp(.6rem,1.2vw,.9rem)] font-bold tracking-[.18em] text-[#C9A86A]">
                    {campaign.eyebrow}
                  </p>
                  <h3 className="mt-3 max-w-[90%] text-[clamp(1.5rem,4vw,3.4rem)] font-bold leading-[1.02] tracking-tight">
                    {title}
                  </h3>
                  <p className="mt-4 max-w-[85%] text-[clamp(.75rem,1.5vw,1.1rem)] leading-relaxed text-[#F5EEE8]">
                    {subtitle}
                  </p>
                  <div className="mt-6 flex items-end justify-between gap-4">
                    <span className="rounded-full bg-[#C9A86A] px-4 py-2 text-[clamp(.5rem,1vw,.72rem)] font-bold tracking-wide text-[#241713]">
                      {cta}
                    </span>
                    <p className="text-[clamp(.55rem,1vw,.8rem)] font-bold tracking-[.16em] text-[#C9A86A]">
                      SEUAGENDAMENTO
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Legenda sugerida</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{campaign.caption}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={async () => {
                  await navigator.clipboard.writeText(campaign.caption);
                  toast.success("Legenda copiada");
                }}
              >
                Copiar legenda
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
