import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Copy, Share2, Download, QrCode, Link as LinkIcon, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/link")({
  component: LinkPage,
});

function LinkPage() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const c: any = activeCompany;

  const [slug, setSlug] = useState<string>(c?.slug ?? "");
  const [enabled, setEnabled] = useState<boolean>(c?.online_booking_enabled ?? true);
  const [minAdv, setMinAdv] = useState<number>(c?.min_advance_min ?? 0);
  const [maxAdv, setMaxAdv] = useState<number>(c?.max_advance_days ?? 60);
  const [bufferMin, setBufferMin] = useState<number>(c?.buffer_min ?? 0);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setSlug(c?.slug ?? "");
    setEnabled(c?.online_booking_enabled ?? true);
    setMinAdv(c?.min_advance_min ?? 0);
    setMaxAdv(c?.max_advance_days ?? 60);
    setBufferMin(c?.buffer_min ?? 0);
  }, [c?.id]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = useMemo(() => (slug ? `${origin}/b/${slug}` : ""), [slug, origin]);

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 512, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
      .then(setQrDataUrl).catch(() => {});
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: 240, margin: 1 }).catch(() => {});
    }
  }, [url]);

  const save = useMutation({
    mutationFn: async () => {
      const cleanSlug = slugify(slug);
      if (!cleanSlug) throw new Error("Slug obrigatório");
      const { error } = await supabase.from("companies").update({
        slug: cleanSlug,
        online_booking_enabled: enabled,
        min_advance_min: Math.max(0, minAdv | 0),
        max_advance_days: Math.max(1, maxAdv | 0),
        buffer_min: Math.max(0, bufferMin | 0),
      } as any).eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["my-companies"] });
      qc.invalidateQueries({ queryKey: ["company-full", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success("Link copiado"); }
    catch { toast.error("Não foi possível copiar"); }
  };

  const share = async () => {
    const text = `Agende comigo: ${activeCompany?.name}\n${url}`;
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: activeCompany?.name, text, url }); return; } catch {}
    }
    copy();
  };

  const downloadPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qr-${slug || "agenda"}.png`;
    a.click();
  };

  const printQr = () => {
    if (!qrDataUrl) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>QR ${activeCompany?.name}</title></head>
      <body style="text-align:center;font-family:sans-serif;padding:40px;">
      <h2>${activeCompany?.name ?? ""}</h2>
      <p>Agende pelo celular</p>
      <img src="${qrDataUrl}" style="width:320px;height:320px;"/>
      <p style="margin-top:16px;font-size:14px;color:#555">${url}</p>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  const shareWhats = () => {
    const text = `Olá! Agende seu horário em ${activeCompany?.name}: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Link de agendamento</h1>
        <p className="text-sm text-muted-foreground">Compartilhe seu link exclusivo e receba agendamentos online.</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Seu link exclusivo</h2>
          </div>
          <div className="flex gap-2 items-center">
            <Input readOnly value={url} className="font-mono text-sm" />
            <Button variant="outline" size="icon" onClick={copy} title="Copiar"><Copy className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => window.open(url, "_blank")} title="Abrir"><ExternalLink className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={share}><Share2 className="h-4 w-4 mr-2" /> Compartilhar</Button>
            <Button variant="outline" onClick={shareWhats}>WhatsApp</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">QR Code</h2>
          </div>
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <div className="p-3 bg-white rounded-lg border">
              <canvas ref={canvasRef} />
            </div>
            <div className="space-y-2 flex-1">
              <p className="text-sm text-muted-foreground">
                Baixe e use em cartões, panfletos, balcão ou redes sociais.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={downloadPng} disabled={!qrDataUrl}><Download className="h-4 w-4 mr-2" /> Baixar PNG</Button>
                <Button variant="outline" onClick={printQr} disabled={!qrDataUrl}>Imprimir / PDF</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-semibold">Configurações do link</h2>
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Agendamento online ativo</p>
              <p className="text-xs text-muted-foreground">Quando desativado, o link mostra a página mas bloqueia novos agendamentos.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Identificador do link (slug)</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">{origin}/b/</span>
                <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Somente letras, números e hífens. Precisa ser único.</p>
            </div>
            <div>
              <Label>Intervalo entre atendimentos (min)</Label>
              <Input type="number" min={0} value={bufferMin} onChange={(e) => setBufferMin(Number(e.target.value))} />
            </div>
            <div>
              <Label>Antecedência mínima (min)</Label>
              <Input type="number" min={0} value={minAdv} onChange={(e) => setMinAdv(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">Ex.: 60 = clientes só agendam pelo menos 1h antes.</p>
            </div>
            <div>
              <Label>Antecedência máxima (dias)</Label>
              <Input type="number" min={1} value={maxAdv} onChange={(e) => setMaxAdv(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">Ex.: 30 = agenda aberta pelos próximos 30 dias.</p>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar configurações</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure horários, folgas e bloqueios em <b>Configurações</b> e <b>Bloqueios</b>. A duração de cada serviço é definida em <b>Serviços</b>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
