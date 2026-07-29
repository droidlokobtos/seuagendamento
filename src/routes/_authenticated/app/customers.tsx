import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Pencil, Trash2, Search, Users, Phone, Mail, MessageCircle, History, Download, FileText, FileSpreadsheet, Upload,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { dateBR, brl } from "@/lib/format";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ui/image-upload";
import { CustomerProfileDialog } from "@/components/app/CustomerProfileDialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


export const Route = createFileRoute("/_authenticated/app/customers")({
  component: Customers,
});

type C = {
  id: string; name: string; phone: string | null; whatsapp: string | null; email: string | null;
  birthdate: string | null; notes: string | null; tags: string[] | null; photo_url: string | null;
  source: string | null; created_at: string;
};

const SOURCES: Record<string, string> = {
  manual: "Cadastro manual",
  portal_publico: "Portal público",
  importacao: "Importação",
  indicacao: "Indicação",
  redes_sociais: "Redes sociais",
  whatsapp: "WhatsApp",
  outro: "Outro",
};

function labelSource(s: string | null) {
  if (!s) return "—";
  return SOURCES[s] ?? s;
}

function Customers() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const [q, setQ] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [edit, setEdit] = useState<C | null>(null);
  const [open, setOpen] = useState(false);
  const [historyOf, setHistoryOf] = useState<C | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["customers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("company_id", companyId).order("name");
      if (error) throw error;
      return (data ?? []) as C[];
    },
  });

  // Observações do Perfil Inteligente — permitem pesquisar por "alergia", etc.
  const { data: smartNotes = [] } = useQuery({
    queryKey: ["company-smart-notes", companyId],
    queryFn: async () =>
      (await supabase.from("customer_notes").select("customer_id,content").eq("company_id", companyId)).data ?? [],
  });

  const notesByCustomer = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of smartNotes as any[]) {
      m.set(n.customer_id, `${m.get(n.customer_id) ?? ""} ${n.content}`.toLowerCase());
    }
    return m;
  }, [smartNotes]);

  const filtered = useMemo(() => {
    const fromT = from ? new Date(from + "T00:00:00").getTime() : null;
    const toT = to ? new Date(to + "T23:59:59").getTime() : null;
    return data.filter((c) => {
      if (q) {
        const s = q.toLowerCase();
        const ok =
          c.name.toLowerCase().includes(s) ||
          (c.phone ?? "").includes(q) ||
          (c.whatsapp ?? "").includes(q) ||
          (c.email ?? "").toLowerCase().includes(s) ||
          (c.notes ?? "").toLowerCase().includes(s) ||
          (notesByCustomer.get(c.id) ?? "").includes(s);
        if (!ok) return false;
      }
      if (sourceFilter !== "all" && (c.source ?? "manual") !== sourceFilter) return false;
      const t = new Date(c.created_at).getTime();
      if (fromT && t < fromT) return false;
      if (toT && t > toT) return false;
      return true;
    });
  }, [data, q, sourceFilter, from, to, notesByCustomer]);


  const save = useMutation({
    mutationFn: async (v: Partial<C>) => {
      if (edit) {
        const { error } = await supabase.from("customers").update(v).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({ ...v, company_id: companyId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(edit ? "Cliente atualizado" : "Cliente criado");
      qc.invalidateQueries({ queryKey: ["customers", companyId] });
      setOpen(false); setEdit(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["customers", companyId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const fetchHistoryMap = async (ids: string[]) => {
    if (!ids.length) return new Map<string, any[]>();
    const { data } = await supabase
      .from("appointments")
      .select("id, customer_id, starts_at, status, total_cents, discount_cents, appointment_services(services(name))")
      .in("customer_id", ids)
      .order("starts_at", { ascending: false });
    const map = new Map<string, any[]>();
    (data ?? []).forEach((a: any) => {
      const arr = map.get(a.customer_id) ?? [];
      arr.push(a);
      map.set(a.customer_id, arr);
    });
    return map;
  };

  const exportCSV = async () => {
    const hist = await fetchHistoryMap(filtered.map((c) => c.id));
    const header = [
      "Nome", "Telefone", "WhatsApp", "E-mail", "Aniversário",
      "Origem", "Observações", "Cadastrado em",
      "Total de agendamentos", "Último agendamento", "Faturamento (R$)",
    ];
    const rows = filtered.map((c) => {
      const list = hist.get(c.id) ?? [];
      const total = list.length;
      const last = list[0]?.starts_at ? dateBR(list[0].starts_at) : "";
      const revenue = list
        .filter((a) => a.status === "completed")
        .reduce((s, a) => s + (a.total_cents - (a.discount_cents ?? 0)), 0) / 100;
      return [
        c.name, c.phone ?? "", c.whatsapp ?? "", c.email ?? "",
        c.birthdate ? dateBR(c.birthdate) : "",
        labelSource(c.source), (c.notes ?? "").replace(/\n/g, " "),
        dateBR(c.created_at),
        String(total), last, revenue.toFixed(2).replace(".", ","),
      ];
    });
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exportados ${filtered.length} clientes`);
  };

  const exportPDF = async () => {
    const hist = await fetchHistoryMap(filtered.map((c) => c.id));
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`Clientes — ${activeCompany!.name}`, 14, 14);
    doc.setFontSize(9);
    const periodo = from || to ? `Período: ${from || "início"} até ${to || "hoje"}` : "Período: todos";
    doc.text(`${periodo}   •   Total: ${filtered.length}`, 14, 20);

    autoTable(doc, {
      startY: 26,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 42, 31] },
      head: [["Nome", "Contato", "Origem", "Cadastro", "Agend.", "Último", "Faturamento"]],
      body: filtered.map((c) => {
        const list = hist.get(c.id) ?? [];
        const revenue = list
          .filter((a) => a.status === "completed")
          .reduce((s, a) => s + (a.total_cents - (a.discount_cents ?? 0)), 0);
        return [
          c.name,
          [c.phone, c.whatsapp, c.email].filter(Boolean).join("\n"),
          labelSource(c.source),
          dateBR(c.created_at),
          String(list.length),
          list[0]?.starts_at ? dateBR(list[0].starts_at) : "—",
          brl(revenue),
        ];
      }),
    });

    doc.save(`clientes-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF gerado");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Base de clientes da empresa.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Importar contatos
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!filtered.length}>
                <Download className="h-4 w-4 mr-2" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportCSV}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> CSV (Excel)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF}>
                <FileText className="h-4 w-4 mr-2" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEdit(null)}><Plus className="h-4 w-4 mr-2" /> Novo cliente</Button>
            </DialogTrigger>
            <CustomerDialog key={edit?.id ?? "new"} edit={edit} onSave={(v) => save.mutate(v)} loading={save.isPending} />
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, telefone, WhatsApp ou e-mail…" className="pl-9"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              {Object.entries(SOURCES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="De" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="Até" />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {q || sourceFilter !== "all" || from || to ? "Nenhum cliente encontrado com os filtros." : "Nenhum cliente cadastrado ainda."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-11 w-11">
                      {c.photo_url && <AvatarImage src={c.photo_url} alt={c.name} />}
                      <AvatarFallback>{c.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                        {c.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{c.phone}</p>}
                        {c.whatsapp && <p className="flex items-center gap-1.5"><MessageCircle className="h-3 w-3" />{c.whatsapp}</p>}
                        {c.email && <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" />{c.email}</p>}
                        {c.birthdate && <p>🎂 {dateBR(c.birthdate)}</p>}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-[10px]">{labelSource(c.source)}</Badge>
                      </div>
                      {c.notes && (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2 italic">"{c.notes}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" title="Histórico" onClick={() => setHistoryOf(c)}>
                      <History className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEdit(c); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(c.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!historyOf} onOpenChange={(o) => !o && setHistoryOf(null)}>
        {historyOf && <CustomerProfileDialog customer={historyOf as any} companyId={companyId} initialTab="smart" />}
      </Dialog>


      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        {importOpen && (
          <ImportContactsDialog
            existing={data}
            companyId={companyId}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["customers", companyId] });
              setImportOpen(false);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function CustomerDialog({
  edit, onSave, loading,
}: { edit: C | null; onSave: (v: Partial<C>) => void; loading: boolean }) {
  const [f, setF] = useState<Partial<C>>(edit ?? { name: "", source: "manual" });
  return (
    <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{edit ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Foto</Label>
          <ImageUpload value={f.photo_url} folder="customers" preset="avatar" onChange={(url) => setF({ ...f, photo_url: url })} />
        </div>
        <div><Label>Nome</Label>
          <Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Telefone</Label>
            <Input value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><Label>WhatsApp</Label>
            <Input value={f.whatsapp ?? ""} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>E-mail</Label>
            <Input type="email" value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><Label>Aniversário</Label>
            <Input type="date" value={f.birthdate ?? ""} onChange={(e) => setF({ ...f, birthdate: e.target.value })} /></div>
        </div>
        <div>
          <Label>Origem do cliente</Label>
          <Select value={f.source ?? "manual"} onValueChange={(v) => setF({ ...f, source: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(SOURCES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Observações</Label>
          <Textarea rows={3} placeholder="Preferências, alergias, anotações internas…"
            value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(f)} disabled={loading || !f.name}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}


type ImportRow = {
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  selected: boolean;
  existingId: string | null;
  action: "create" | "update" | "keep_both" | "ignore";
};

function normalizePhone(s: string): string {
  return (s || "").replace(/\D+/g, "");
}

function decodeQuotedPrintable(input: string, charset = "utf-8"): string {
  try {
    const bytes: number[] = [];
    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      if (c === "=" && i + 2 < input.length) {
        const hex = input.slice(i + 1, i + 3);
        if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
          bytes.push(parseInt(hex, 16));
          i += 2;
          continue;
        }
      }
      bytes.push(c.charCodeAt(0));
    }
    return new TextDecoder(charset.toLowerCase()).decode(new Uint8Array(bytes));
  } catch {
    return input;
  }
}

function unfoldVcf(text: string): string[] {
  // vCard line folding: continuation lines begin with space/tab. Also handle
  // quoted-printable soft line breaks ("=" at end of line).
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if (!out.length) { out.push(line); continue; }
    const prev = out[out.length - 1];
    if (/^[ \t]/.test(line)) {
      out[out.length - 1] = prev + line.slice(1);
    } else if (/=$/.test(prev) && /ENCODING=QUOTED-PRINTABLE/i.test(prev)) {
      out[out.length - 1] = prev.slice(0, -1) + line;
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseVCF(text: string): { name: string; phone: string; email: string }[] {
  const allLines = unfoldVcf(text);
  const out: { name: string; phone: string; email: string }[] = [];
  let cur: { name: string; phone: string; email: string } | null = null;
  for (const line of allLines) {
    if (/^BEGIN:VCARD/i.test(line)) { cur = { name: "", phone: "", email: "" }; continue; }
    if (/^END:VCARD/i.test(line)) {
      if (cur && (cur.name || cur.phone)) out.push({ ...cur, name: cur.name || cur.phone || "Sem nome" });
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const head = line.slice(0, colonIdx);
    let value = line.slice(colonIdx + 1).trim();
    if (!value) continue;
    const params = head.split(";");
    const key = params[0].split(".").pop()!.toUpperCase(); // strip "item1." prefix
    const isQP = params.some((p) => /ENCODING=QUOTED-PRINTABLE/i.test(p));
    const charsetParam = params.find((p) => /^CHARSET=/i.test(p));
    const charset = charsetParam ? charsetParam.split("=")[1] : "utf-8";
    if (isQP) value = decodeQuotedPrintable(value, charset);
    if (key === "FN") { if (!cur.name) cur.name = value; }
    else if (key === "N") {
      if (!cur.name) {
        const parts = value.split(";");
        cur.name = [parts[1], parts[0], parts[2]].filter(Boolean).join(" ").trim() || parts.filter(Boolean).join(" ").trim();
      }
    } else if (key === "TEL") { if (!cur.phone) cur.phone = value; }
    else if (key === "EMAIL") { if (!cur.email) cur.email = value; }
  }
  return out;
}

function parseCSV(text: string): { name: string; phone: string; email: string }[] {
  const clean = text.replace(/^\ufeff/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const delim = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const splitRow = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === delim && !inQ) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const header = splitRow(lines[0]).map((h) => h.toLowerCase());
  const findIdx = (keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  const iName = findIdx(["nome", "name", "first name", "given name"]);
  const iLast = findIdx(["sobrenome", "last name", "family name"]);
  const iPhone = findIdx(["telefone", "phone", "mobile", "celular", "whatsapp"]);
  const iEmail = findIdx(["e-mail", "email"]);
  const rows: { name: string; phone: string; email: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    const name = [cols[iName] ?? "", cols[iLast] ?? ""].filter(Boolean).join(" ").trim();
    const phone = iPhone >= 0 ? cols[iPhone] ?? "" : "";
    const email = iEmail >= 0 ? cols[iEmail] ?? "" : "";
    if (!name && !phone && !email) continue;
    rows.push({ name: name || phone || email || "Sem nome", phone, email });
  }
  return rows;
}

function ImportContactsDialog({
  existing, companyId, onDone,
}: { existing: C[]; companyId: string; onDone: () => void }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  const phoneMap = useMemo(() => {
    const m = new Map<string, C>();
    for (const c of existing) {
      const p = normalizePhone(c.whatsapp || c.phone || "");
      if (p) m.set(p, c);
    }
    return m;
  }, [existing]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const isVcf = /\.vcf$/i.test(file.name) || /BEGIN:VCARD/i.test(text);
    const parsed = isVcf ? parseVCF(text) : parseCSV(text);
    const mapped: ImportRow[] = parsed.map((p) => {
      const phoneNorm = normalizePhone(p.phone);
      const existingC = phoneNorm ? phoneMap.get(phoneNorm) ?? null : null;
      return {
        name: p.name,
        phone: p.phone,
        whatsapp: p.phone,
        email: p.email,
        selected: true,
        existingId: existingC?.id ?? null,
        action: existingC ? "ignore" : "create",
      };
    });
    setRows(mapped);
  };

  const toggle = (i: number, patch: Partial<ImportRow>) => {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };

  const selectedCount = rows.filter((r) => r.selected).length;
  const dupCount = rows.filter((r) => r.existingId).length;

  const runImport = async () => {
    setLoading(true);
    try {
      const toInsert: any[] = [];
      const toUpdate: { id: string; values: any }[] = [];
      for (const r of rows) {
        if (!r.selected) continue;
        const values = {
          name: r.name.trim(),
          phone: r.phone.trim() || null,
          whatsapp: r.whatsapp.trim() || null,
          email: r.email.trim() || null,
          source: "importacao",
        };
        if (!values.name) continue;
        if (r.existingId && r.action === "ignore") continue;
        if (r.existingId && r.action === "update") {
          toUpdate.push({ id: r.existingId, values });
        } else {
          // create or keep_both
          toInsert.push({ ...values, company_id: companyId });
        }
      }
      if (toInsert.length) {
        const { error } = await supabase.from("customers").insert(toInsert as any);
        if (error) throw error;
      }
      for (const u of toUpdate) {
        const { error } = await supabase.from("customers").update(u.values).eq("id", u.id);
        if (error) throw error;
      }
      toast.success(`Importação concluída: ${toInsert.length} criados, ${toUpdate.length} atualizados`);
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao importar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Importar contatos do WhatsApp</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="rounded-md border border-dashed p-4 text-sm">
          <p className="mb-2 text-muted-foreground">
            Selecione um arquivo <b>.vcf</b> (exportado do WhatsApp / Google Contatos) ou <b>.csv</b>.
          </p>
          <Input
            type="file"
            accept=".vcf,.csv,text/vcard,text/csv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {fileName && <p className="mt-2 text-xs text-muted-foreground">Arquivo: {fileName} • {rows.length} contatos lidos • {dupCount} já existem</p>}
        </div>

        {rows.length > 0 && (
          <div className="rounded-md border">
            <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 border-b bg-muted/40 p-2 text-xs font-medium">
              <div>Sel.</div>
              <div>Nome</div>
              <div>Telefone / E-mail</div>
              <div>Ação</div>
            </div>
            <div className="max-h-[45vh] overflow-y-auto">
              {rows.map((r, i) => (
                <div key={i} className={`grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 border-b p-2 text-xs ${r.existingId ? "bg-amber-50/40" : ""}`}>
                  <Checkbox checked={r.selected} onCheckedChange={(v) => toggle(i, { selected: !!v })} />
                  <div className="min-w-0">
                    <Input className="h-7 text-xs" value={r.name} onChange={(e) => toggle(i, { name: e.target.value })} />
                    {r.existingId && <p className="mt-0.5 text-[10px] text-amber-700">Já existe no cadastro</p>}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Input className="h-7 text-xs" value={r.phone} onChange={(e) => toggle(i, { phone: e.target.value, whatsapp: e.target.value })} placeholder="Telefone" />
                    {r.email && <Input className="h-7 text-xs" value={r.email} onChange={(e) => toggle(i, { email: e.target.value })} placeholder="E-mail" />}
                  </div>
                  <div>
                    {r.existingId ? (
                      <Select value={r.action} onValueChange={(v) => toggle(i, { action: v as any })}>
                        <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ignore">Ignorar</SelectItem>
                          <SelectItem value="update">Atualizar</SelectItem>
                          <SelectItem value="keep_both">Manter ambos</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Novo</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={loading}>Cancelar</Button>
        <Button onClick={runImport} disabled={loading || !selectedCount}>
          {loading ? "Importando…" : `Importar ${selectedCount} contato(s)`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
