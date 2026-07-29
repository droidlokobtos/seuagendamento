import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, FileText, Download, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { dateBR } from "@/lib/format";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { AnamnesisForm } from "@/components/app/AnamnesisForm";
import {
  BASE_SECTION, SECTION_OPTIONS, SECTIONS, buildQuestionnaire, daysUntilExpiry, extractAlerts,
  isExpired, logAnamnesisAccess, useAnamnesisLog, useAnamnesisRecords, type AnamnesisRecord,
} from "@/lib/anamnesis";

/** Verifica se o usuário atual é administrador da empresa (ou master). */
export function useIsCompanyAdmin(companyId: string) {
  const { user, isSuperAdmin } = useAuth();
  const { data } = useQuery({
    enabled: !!user && !isSuperAdmin,
    queryKey: ["is-company-admin", companyId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_users").select("role")
        .eq("company_id", companyId).eq("user_id", user!.id).maybeSingle();
      return data?.role ?? null;
    },
  });
  return isSuperAdmin || data === "company_admin";
}

export function AnamnesisTab({
  companyId, customerId, customerName,
}: { companyId: string; customerId: string; customerName: string }) {
  const qc = useQueryClient();
  const isAdmin = useIsCompanyAdmin(companyId);
  const { data: records = [], isLoading } = useAnamnesisRecords(isAdmin ? customerId : null);
  const { data: logs = [] } = useAnamnesisLog(isAdmin ? customerId : null);
  const [openRecord, setOpenRecord] = useState<string | null>(null);

  const last = records[0] ?? null;
  const expired = isExpired(last?.filled_at);


  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("anamnesis_records").delete().eq("id", id);
      if (error) throw error;
      await logAnamnesisAccess({ companyId, customerId, recordId: id, action: "delete", detail: "Ficha excluída (LGPD)" });
    },
    onSuccess: () => {
      toast.success("Ficha excluída.");
      qc.invalidateQueries({ queryKey: ["anamnesis", customerId] });
      qc.invalidateQueries({ queryKey: ["anamnesis-log", customerId] });
    },
  });

  const exportPdf = (r: AnamnesisRecord) => {
    const doc = new jsPDF();
    let y = 16;
    doc.setFontSize(14);
    doc.text("Ficha de Anamnese", 14, y); y += 8;
    doc.setFontSize(10);
    doc.text(`Cliente: ${customerName}`, 14, y); y += 6;
    doc.text(`Preenchida em: ${dateBR(r.filled_at)} · por ${r.filled_by === "admin" ? "administrador" : "cliente"}`, 14, y); y += 8;

    for (const sec of buildQuestionnaire(r.sections ?? [])) {
      doc.setFont(undefined as any, "bold");
      doc.text(`${sec.label}`, 14, y); y += 6;
      doc.setFont(undefined as any, "normal");
      for (const q of sec.questions) {
        const v = r.answers?.[q.key];
        if (v === undefined || v === null || v === "") continue;
        const val = v === true ? "Sim" : v === false ? "Não" : String(v);
        const det = q.detail && r.answers?.[q.detail] ? ` — ${r.answers[q.detail]}` : "";
        const lines = doc.splitTextToSize(`• ${q.label}: ${val}${det}`, 180);
        if (y > 270) { doc.addPage(); y = 16; }
        doc.text(lines, 16, y); y += lines.length * 5;
      }
      y += 3;
    }
    if (r.alerts?.length) {
      if (y > 250) { doc.addPage(); y = 16; }
      doc.setFont(undefined as any, "bold");
      doc.text("Alertas críticos", 14, y); y += 6;
      doc.setFont(undefined as any, "normal");
      for (const a of r.alerts) { doc.text(`! ${a}`, 16, y); y += 5; }
    }
    if (r.signature_data) {
      if (y > 220) { doc.addPage(); y = 16; }
      y += 6;
      doc.text("Assinatura:", 14, y); y += 4;
      try { doc.addImage(r.signature_data, "PNG", 14, y, 70, 22); } catch { /* ignore */ }
    }
    doc.save(`anamnese-${customerName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    void logAnamnesisAccess({ companyId, customerId, recordId: r.id, action: "export", detail: "Exportada em PDF" });
  };

  if (!isAdmin) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        🔒 A ficha de anamnese é restrita aos administradores da empresa.
      </p>
    );
  }


  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Status da ficha</p>
            {!last && <p className="text-xs text-muted-foreground">Nenhuma ficha preenchida.</p>}
            {last && (
              <p className="text-xs text-muted-foreground">
                Última: {dateBR(last.filled_at)} ·{" "}
                {expired ? "vencida (mais de 6 meses)" : `válida por mais ${daysUntilExpiry(last.filled_at)} dias`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={expired ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-700"}>
              {expired ? "⚠️ Pendente" : "✅ Válida"}
            </Badge>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        A ficha é preenchida exclusivamente pelo cliente durante o agendamento no link público.
      </p>
        </CardContent>
      </Card>

      {!!last?.alerts?.length && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" /> Alertas críticos
            </p>
            <ul className="space-y-1 text-xs">
              {last.alerts.map((a, i) => <li key={i}>• {a}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>}

      <div className="space-y-2">
        {records.map((r) => (
          <div key={r.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {dateBR(r.filled_at)}
                  {r.signature_data && <ShieldCheck className="h-3.5 w-3.5 text-green-600" />}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(r.sections ?? []).map((s) => SECTIONS[s]?.label ?? s).join(", ") || BASE_SECTION.label}
                  {" · "}{r.filled_by === "admin" ? "preenchida no salão" : "preenchida pelo cliente"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => {
                  const next = openRecord === r.id ? null : r.id;
                  setOpenRecord(next);
                  if (next) void logAnamnesisAccess({ companyId, customerId, recordId: r.id, action: "view" });
                }}>
                  {openRecord === r.id ? "Fechar" : "Ver"}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => exportPdf(r)}><Download className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => {
                  if (confirm("Excluir esta ficha? A ação é registrada na auditoria.")) remove.mutate(r.id);
                }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>

            {openRecord === r.id && (
              <div className="mt-3 space-y-3">
                <Separator />
                {buildQuestionnaire(r.sections ?? []).map((sec) => (
                  <div key={sec.key}>
                    <p className="text-xs font-semibold">{sec.emoji} {sec.label}</p>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {sec.questions.map((q) => {
                        const v = r.answers?.[q.key];
                        if (v === undefined || v === null || v === "") return null;
                        const val = v === true ? "Sim" : v === false ? "Não" : String(v);
                        const det = q.detail && r.answers?.[q.detail] ? ` — ${r.answers[q.detail]}` : "";
                        return <li key={q.key}>• {q.label}: <span className="text-foreground">{val}{det}</span></li>;
                      })}
                    </ul>
                  </div>
                ))}
                {r.signature_data && (
                  <div>
                    <p className="text-xs font-semibold">Assinatura</p>
                    <img src={r.signature_data} alt="Assinatura do cliente" className="mt-1 h-20 rounded border bg-background" />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {!isLoading && !records.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma ficha registrada ainda.</p>
        )}
      </div>

      {!!logs.length && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-xs font-semibold">Auditoria de acesso (LGPD)</p>
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {(logs as any[]).slice(0, 15).map((l) => (
                <li key={l.id}>
                  {dateBR(l.created_at)} · {l.action}{l.detail ? ` — ${l.detail}` : ""}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
