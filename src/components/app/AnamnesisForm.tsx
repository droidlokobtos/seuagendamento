import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eraser } from "lucide-react";
import { LGPD_TEXT, missingRequired, type Section } from "@/lib/anamnesis";
import { DEFAULT_TERMS, type ConsentTerm } from "@/lib/custom-forms";
import { toast } from "sonner";

export type AnamnesisSubmit = {
  answers: Record<string, any>;
  consent_truth: boolean;
  consent_procedure: boolean;
  consent_lgpd: boolean;
  signature_data: string | null;
  accepted_terms: Record<string, boolean>;
  before_photos: string[];
  after_photos: string[];
};

async function imageFiles(files: FileList | null): Promise<string[]> {
  const selected = Array.from(files ?? []).slice(0, 4);
  return Promise.all(
    selected.map(async (file) => {
      if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024)
        throw new Error("Use imagens de até 10 MB.");
      const image = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();
      return canvas.toDataURL("image/jpeg", 0.82);
    }),
  );
}

export function SignaturePad({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    if (!value) ctx.clearRect(0, 0, c.width, c.height);
  }, [value]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        width={600}
        height={180}
        className="w-full touch-none rounded-md border bg-background"
        onPointerDown={(e) => {
          const c = ref.current;
          const ctx = c?.getContext("2d");
          if (!c || !ctx) return;
          drawing.current = true;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = ref.current?.getContext("2d");
          if (!ctx) return;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          const c = ref.current;
          if (c) onChange(c.toDataURL("image/png"));
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          const c = ref.current;
          const ctx = c?.getContext("2d");
          if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
          onChange(null);
        }}
      >
        <Eraser className="mr-2 h-4 w-4" /> Limpar assinatura
      </Button>
    </div>
  );
}

export function AnamnesisForm({
  sections,
  initialAnswers,
  submitLabel = "Salvar ficha",
  requireSignature = true,
  terms = DEFAULT_TERMS,
  allowBeforePhotos = false,
  allowAfterPhotos = false,
  onSubmit,
  submitting,
}: {
  sections: Section[];
  initialAnswers?: Record<string, any>;
  submitLabel?: string;
  requireSignature?: boolean;
  terms?: ConsentTerm[];
  allowBeforePhotos?: boolean;
  allowAfterPhotos?: boolean;
  onSubmit: (data: AnamnesisSubmit) => void | Promise<void>;
  submitting?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers ?? {});
  const [acceptedTerms, setAcceptedTerms] = useState<Record<string, boolean>>({});
  const [sig, setSig] = useState<string | null>(null);
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);

  const set = (k: string, v: any) => setAnswers((a) => ({ ...a, [k]: v }));

  const submit = () => {
    const missing = missingRequired(sections, answers);
    if (missing.length) return toast.error(`Responda: ${missing[0]}`);
    const missingTerm = terms.find((term) => term.required && !acceptedTerms[term.id]);
    if (missingTerm) return toast.error(`Aceite o termo: ${missingTerm.label}.`);
    if (requireSignature && !sig) return toast.error("Assinatura digital obrigatória.");
    void onSubmit({
      answers,
      consent_truth: acceptedTerms.truth ?? true,
      consent_procedure: acceptedTerms.procedure ?? true,
      consent_lgpd: acceptedTerms.lgpd ?? true,
      signature_data: sig,
      accepted_terms: acceptedTerms,
      before_photos: beforePhotos,
      after_photos: afterPhotos,
    });
  };

  return (
    <div className="space-y-4">
      {sections.map((sec) => (
        <Card key={sec.key}>
          <CardContent className="space-y-4 p-4">
            <div>
              <p className="text-sm font-semibold">
                {sec.emoji} {sec.label}
              </p>
              {sec.description && (
                <p className="text-xs text-muted-foreground">{sec.description}</p>
              )}
            </div>

            {sec.questions.map((q) => {
              if (q.showIf && answers[q.showIf] !== true) return null;
              return (
                <div key={q.key} className="space-y-2">
                  <Label className="text-sm font-normal">
                    {q.label} {q.required && <span className="text-destructive">*</span>}
                  </Label>

                  {q.type === "boolean" && (
                    <div className="flex gap-2">
                      {[true, false].map((v) => (
                        <Button
                          key={String(v)}
                          type="button"
                          size="sm"
                          variant={answers[q.key] === v ? "default" : "outline"}
                          onClick={() => set(q.key, v)}
                        >
                          {v ? "Sim" : "Não"}
                        </Button>
                      ))}
                    </div>
                  )}

                  {q.type === "text" && (
                    <Textarea
                      rows={2}
                      value={answers[q.key] ?? ""}
                      onChange={(e) => set(q.key, e.target.value)}
                    />
                  )}

                  {q.type === "select" && (
                    <Select value={answers[q.key] ?? ""} onValueChange={(v) => set(q.key, v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {(q.options ?? []).map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {q.type === "multi" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(q.options ?? []).map((option) => {
                        const current = Array.isArray(answers[q.key]) ? answers[q.key] : [];
                        return (
                          <label key={option} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={current.includes(option)}
                              onCheckedChange={(checked) =>
                                set(
                                  q.key,
                                  checked
                                    ? [...current, option]
                                    : current.filter((v: string) => v !== option),
                                )
                              }
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {q.detail && answers[q.key] === true && (
                    <Input
                      placeholder={q.detailLabel ?? "Detalhe"}
                      value={answers[q.detail] ?? ""}
                      onChange={(e) => set(q.detail!, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-semibold">📝 Termos e consentimento</p>
          {terms.map((term) => (
            <label key={term.id} className="flex items-start gap-2 text-xs">
              <Checkbox
                checked={!!acceptedTerms[term.id]}
                onCheckedChange={(v) =>
                  setAcceptedTerms((current) => ({ ...current, [term.id]: !!v }))
                }
              />
              <span>
                <strong>{term.label}:</strong>{" "}
                {term.id === "lgpd" && term.text === DEFAULT_TERMS[2].text ? LGPD_TEXT : term.text}
                {term.required && " *"}
              </span>
            </label>
          ))}

          {(allowBeforePhotos || allowAfterPhotos) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {allowBeforePhotos && (
                <div className="space-y-2">
                  <Label className="text-xs">Fotos antes do procedimento (até 4)</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) =>
                      void imageFiles(e.target.files)
                        .then(setBeforePhotos)
                        .catch((error: Error) => toast.error(error.message))
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {beforePhotos.length} foto(s) selecionada(s)
                  </p>
                </div>
              )}
              {allowAfterPhotos && (
                <div className="space-y-2">
                  <Label className="text-xs">Fotos depois do procedimento (até 4)</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) =>
                      void imageFiles(e.target.files)
                        .then(setAfterPhotos)
                        .catch((error: Error) => toast.error(error.message))
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {afterPhotos.length} foto(s) selecionada(s)
                  </p>
                </div>
              )}
            </div>
          )}

          {requireSignature && (
            <div className="space-y-2 pt-1">
              <Label className="text-xs">Assinatura digital *</Label>
              <SignaturePad value={sig} onChange={setSig} />
            </div>
          )}

          <Button className="w-full" onClick={submit} disabled={submitting}>
            {submitting ? "Enviando…" : submitLabel}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
