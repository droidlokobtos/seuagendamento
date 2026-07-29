import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, Crop } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { validateUploadedImage } from "@/lib/uploads.functions";
import {
  IMAGE_PRESETS,
  dimensionsMatch,
  presetError,
  presetHint,
  type ImagePreset,
  type ImagePresetKey,
} from "@/lib/image-presets";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

async function loadBitmap(file: File) {
  return createImageBitmap(file).catch(() => null);
}

/** Recorta/redimensiona (cover) para o tamanho exato do preset mantendo a qualidade. */
function fitToPreset(bitmap: ImageBitmap, p: ImagePreset): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = p.width;
  canvas.height = p.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const scale = Math.max(p.width / bitmap.width, p.height / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (p.width - w) / 2, (p.height - h) / 2, w, h);
  return new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.95));
}

export function ImageUpload({
  value,
  onChange,
  folder = "misc",
  aspect = "square",
  label = "Enviar imagem",
  preset,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  folder?: string;
  aspect?: "square" | "wide";
  label?: string;
  /** Chave da configuração de dimensões (src/lib/image-presets.ts) */
  preset?: ImagePresetKey;
}) {
  const { activeCompany } = useCompany();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const validate = useServerFn(validateUploadedImage);

  const cfg: ImagePreset | null = preset ? IMAGE_PRESETS[preset] : null;
  const maxMB = cfg?.maxSizeMB ?? 5;

  const doUpload = async (blob: Blob) => {
    // Os arquivos ficam sempre dentro da pasta da empresa: as regras de acesso
    // do armazenamento liberam somente a pasta da própria empresa.
    if (!activeCompany?.id) throw new Error("Selecione uma empresa antes de enviar imagens.");
    const path = `${activeCompany.id}/${folder}/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await supabase.storage.from("company-assets").upload(path, blob, {
      cacheControl: "31536000",
      upsert: false,
      contentType: "image/jpeg",
    });
    if (upErr) throw upErr;

    if (preset) {
      const res = await validate({ data: { path, preset } });
      if (!res.ok) {
        throw new Error(res.error);
      }
    }

    const { data, error: signErr } = await supabase.storage
      .from("company-assets")
      .createSignedUrl(path, TEN_YEARS);
    if (signErr) throw signErr;
    onChange(data.signedUrl);
  };

  const handleFile = async (file: File, autoFit = false) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem.");
      return;
    }
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`Imagem muito grande (máx. ${maxMB}MB).`);
      return;
    }
    setBusy(true);
    try {
      const bitmap = await loadBitmap(file);
      if (!bitmap) throw new Error("Não foi possível ler a imagem.");

      let blob: Blob | null;
      if (cfg) {
        const ok = dimensionsMatch(cfg, bitmap.width, bitmap.height);
        if (!ok && !autoFit) {
          setPending(file);
          setError(presetError(cfg, bitmap.width, bitmap.height));
          toast.error(presetError(cfg, bitmap.width, bitmap.height));
          setBusy(false);
          return;
        }
        blob = await fitToPreset(bitmap, cfg);
      } else {
        blob = await fitToPreset(bitmap, {
          label: "",
          width: Math.min(bitmap.width, aspect === "wide" ? 1920 : 1200),
          height: Math.round(
            bitmap.height * Math.min(1, (aspect === "wide" ? 1920 : 1200) / bitmap.width),
          ),
        });
      }
      await doUpload(blob ?? file);
      setPending(null);
      setError(null);
      toast.success("Imagem enviada");
    } catch (e: any) {
      setError(e.message || "Falha ao enviar");
      toast.error(e.message || "Falha ao enviar");
    } finally {
      setBusy(false);
    }
  };

  const ratio = cfg ? cfg.width / cfg.height : aspect === "wide" ? 3 : 1;
  const boxStyle = { aspectRatio: String(ratio) };
  const boxClass = ratio >= 1.6 ? "w-full max-w-sm" : ratio < 1 ? "w-28" : "w-32";

  return (
    <div className="space-y-2">
      <div
        style={boxStyle}
        className={`${boxClass} relative overflow-hidden rounded-lg border border-dashed border-border/60 bg-muted/30 flex items-center justify-center`}
      >
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-muted-foreground">Sem imagem</span>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload className="mr-2 h-4 w-4" />
          {label}
        </Button>
        {pending && cfg && (
          <Button type="button" size="sm" onClick={() => handleFile(pending, true)} disabled={busy}>
            <Crop className="mr-2 h-4 w-4" />
            Ajustar para {cfg.width} × {cfg.height}
          </Button>
        )}
        {value && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)} disabled={busy}>
            <X className="mr-2 h-4 w-4" />
            Remover
          </Button>
        )}
      </div>
      {cfg && <p className="text-xs text-muted-foreground">{presetHint(cfg)}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
