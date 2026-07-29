import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eraser } from "lucide-react";
import { LGPD_TEXT, missingRequired, type Section } from "@/lib/anamnesis";
import { toast } from "sonner";

export type AnamnesisSubmit = {
  answers: Record<string, any>;
  consent_truth: boolean;
  consent_procedure: boolean;
  consent_lgpd: boolean;
  signature_data: string | null;
};

export function SignaturePad({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
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
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        width={600}
        height={180}
        className="w-full touch-none rounded-md border bg-background"
        onPointerDown={(e) => {
          drawing.current = true;
          const ctx = ref.current!.getContext("2d")!;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = ref.current!.getContext("2d")!;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          onChange(ref.current!.toDataURL("image/png"));
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          const c = ref.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
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
  onSubmit,
  submitting,
}: {
  sections: Section[];
  initialAnswers?: Record<string, any>;
  submitLabel?: string;
  requireSignature?: boolean;
  onSubmit: (data: AnamnesisSubmit) => void | Promise<void>;
  submitting?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers ?? {});
  const [truth, setTruth] = useState(false);
  const [proc, setProc] = useState(false);
  const [lgpd, setLgpd] = useState(false);
  const [sig, setSig] = useState<string | null>(null);

  const set = (k: string, v: any) => setAnswers((a) => ({ ...a, [k]: v }));

  const submit = () => {
    const missing = missingRequired(sections, answers);
    if (missing.length) return toast.error(`Responda: ${missing[0]}`);
    if (!truth || !proc || !lgpd) return toast.error("É necessário aceitar os três termos.");
    if (requireSignature && !sig) return toast.error("Assinatura digital obrigatória.");
    void onSubmit({ answers, consent_truth: truth, consent_procedure: proc, consent_lgpd: lgpd, signature_data: sig });
  };

  return (
    <div className="space-y-4">
      {sections.map((sec) => (
        <Card key={sec.key}>
          <CardContent className="space-y-4 p-4">
            <div>
              <p className="text-sm font-semibold">{sec.emoji} {sec.label}</p>
              {sec.description && <p className="text-xs text-muted-foreground">{sec.description}</p>}
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
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {(q.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
          <label className="flex items-start gap-2 text-xs">
            <Checkbox checked={truth} onCheckedChange={(v) => setTruth(!!v)} />
            <span>Declaro que todas as informações prestadas são verdadeiras.</span>
          </label>
          <label className="flex items-start gap-2 text-xs">
            <Checkbox checked={proc} onCheckedChange={(v) => setProc(!!v)} />
            <span>Estou ciente dos riscos e autorizo a realização do procedimento.</span>
          </label>
          <label className="flex items-start gap-2 text-xs">
            <Checkbox checked={lgpd} onCheckedChange={(v) => setLgpd(!!v)} />
            <span>{LGPD_TEXT}</span>
          </label>

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
