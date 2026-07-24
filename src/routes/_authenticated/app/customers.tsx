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
          (c.email ?? "").toLowerCase().includes(s);
        if (!ok) return false;
      }
      if (sourceFilter !== "all" && (c.source ?? "manual") !== sourceFilter) return false;
      const t = new Date(c.created_at).getTime();
      if (fromT && t < fromT) return false;
      if (toT && t > toT) return false;
      return true;
    });
  }, [data, q, sourceFilter, from, to]);

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
        {historyOf && <HistoryDialog customer={historyOf} />}
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
          <ImageUpload value={f.photo_url} folder="customers" onChange={(url) => setF({ ...f, photo_url: url })} />
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

function HistoryDialog({ customer }: { customer: C }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["customer-history", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, starts_at, status, total_cents, discount_cents, staff:staff_id(name), appointment_services(services(name))")
        .eq("customer_id", customer.id)
        .order("starts_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {customer.photo_url && <AvatarImage src={customer.photo_url} alt="" />}
            <AvatarFallback>{customer.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          Histórico — {customer.name}
        </DialogTitle>
      </DialogHeader>
      {customer.notes && (
        <div className="rounded-md bg-muted/40 p-3 text-xs">
          <span className="font-medium">Observações:</span> {customer.notes}
        </div>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando…</p>
      ) : !data.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum agendamento ainda.</p>
      ) : (
        <div className="space-y-2">
          {data.map((a: any) => {
            const svc = (a.appointment_services ?? []).map((x: any) => x.services?.name).filter(Boolean).join(", ");
            const total = (a.total_cents ?? 0) - (a.discount_cents ?? 0);
            return (
              <div key={a.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">{dateBR(a.starts_at)}</p>
                  <p className="text-xs text-muted-foreground">{svc || "—"}{a.staff?.name ? ` • ${a.staff.name}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{brl(total)}</p>
                  <p className="text-xs text-muted-foreground capitalize">{a.status}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DialogContent>
  );
}
