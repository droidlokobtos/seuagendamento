import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export function ImageUpload({
  value,
  onChange,
  folder = "misc",
  aspect = "square",
  label = "Enviar imagem",
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  folder?: string;
  aspect?: "square" | "wide";
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB).");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("company-assets").upload(path, file, {
        cacheControl: "31536000",
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data, error } = await supabase.storage
        .from("company-assets")
        .createSignedUrl(path, TEN_YEARS);
      if (error) throw error;
      onChange(data.signedUrl);
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar");
    } finally {
      setBusy(false);
    }
  };

  const boxClass = aspect === "wide" ? "h-32 w-full" : "h-24 w-24";

  return (
    <div className="space-y-2">
      <div
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
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload className="mr-2 h-4 w-4" />
          {label}
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)} disabled={busy}>
            <X className="mr-2 h-4 w-4" />
            Remover
          </Button>
        )}
      </div>
    </div>
  );
}
