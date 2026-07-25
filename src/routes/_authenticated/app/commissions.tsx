import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { brl, dateBR } from "@/lib/format";
import { toast } from "sonner";
import {
  BadgePercent, CheckCheck, Trash2, Pencil, Eye, FileDown, FileSpreadsheet, Printer, Wallet, Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/commissions")({
  component: Commissions,
});

type C = {
  id: string; company_id: string; appointment_id: string | null; staff_id: string | null;
  customer_id: string | null; service_id: string | null;
  staff_name: string | null; customer_name: string | null; service_name: string | null;
  service_amount_cents: number; commission_type: string; commission_value: number;
  commission_cents: number; status: string; occurred_at: string; paid_at: string | null;
  notes: string | null; created_at: string;
};

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  paid: { label: "Pago", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  cancelled: { label: "Cancelado", color: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
};

function Commissions() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const { user, isSuperAdmin } = useAuth();
  const companyId = activeCompany!.id;

  const [staffFilter, setStaffFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [edit, setEdit] = useState<C | null>(null);
  const [detail, setDetail] = useState<C | null>(null);

  const { data: myRole } = useQuery({
    queryKey: ["my-company-role", companyId, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("company_users")
        .select("role")
        .eq("company_id", companyId)
        .eq("user_id", user.id)
        .maybeSingle();
      return (data as any)?.role ?? null;
    },
    enabled: !!user?.id,
  });

  const isAdmin = isSuperAdmin || myRole === "company_admin";

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-min", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("staff").select("id, name, user_id").eq("company_id", companyId).order("name");
      return (data ?? []) as { id: string; name: string; user_id: string | null }[];
    },
  });

  const myStaffIds = useMemo(
    () => staff.filter((s) => s.user_id && s.user_id === user?.id).map((s) => s.id),
    [staff, user?.id],
  );

  const { data = [], isLoading } = useQuery({
    queryKey: ["commissions", companyId, isAdmin, myStaffIds.join(",")],
    queryFn: async () => {
      let q = supabase
        .from("commissions")
        .select("*")
        .eq("company_id", companyId)
        .order("occurred_at", { ascending: false });
      if (!isAdmin) q = q.in("staff_id", myStaffIds.length ? myStaffIds : ["00000000-0000-0000-0000-000000000000"]);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as C[];
    },
  });

  const services = useMemo(
    () => Array.from(new Set(data.map((c) => c.service_name).filter(Boolean))) as string[],
    [data],
  );

  const rows = useMemo(
    () =>
      data.filter((c) => {
        if (staffFilter !== "all" && c.staff_id !== staffFilter) return false;
        if (serviceFilter !== "all" && c.service_name !== serviceFilter) return false;
        if (customerFilter && !(c.customer_name ?? "").toLowerCase().includes(customerFilter.toLowerCase())) return false;
        if (statusFilter !== "all" && c.status !== statusFilter) return false;
        const d = c.occurred_at.slice(0, 10);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      }),
    [data, staffFilter, serviceFilter, customerFilter, statusFilter, from, to],
  );

  const totals = useMemo(() => {
    const sold = rows.reduce((a, c) => a + c.service_amount_cents, 0);
    const comm = rows.filter((c) => c.status !== "cancelled").reduce((a, c) => a + c.commission_cents, 0);
    const pending = rows.filter((c) => c.status === "pending").reduce((a, c) => a + c.commission_cents, 0);
    const paid = rows.filter((c) => c.status === "paid").reduce((a, c) => a + c.commission_cents, 0);
    return { sold, comm, pending, paid, count: rows.length };
  }, [rows]);

  const save = useMutation({
    mutationFn: async (v: C) => {
      const cents =
        v.commission_type === "fixed"
          ? Math.round(Number(v.commission_value) * 100)
          : Math.round((v.service_amount_cents * Number(v.commission_value)) / 100);
      const { error } = await supabase
        .from("commissions")
        .update({
          commission_type: v.commission_type,
          commission_value: Number(v.commission_value),
          commission_cents: cents,
          status: v.status,
          notes: v.notes,
          paid_at: v.status === "paid" ? (v.paid_at ?? new Date().toISOString()) : null,
          updated_by: user?.id ?? null,
        } as any)
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comissão atualizada");
      qc.invalidateQueries({ queryKey: ["commissions", companyId] });
      setEdit(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("commissions")
        .update({ status: "paid", paid_at: new Date().toISOString(), updated_by: user?.id ?? null } as any)
        .in("id", ids);
      if (error) throw error;
      await supabase.from("notifications").insert({
        company_id: companyId,
        kind: "commission_paid",
        title: "Comissão paga",
        body: `${ids.length} comissão(ões) marcada(s) como paga`,
        link: "/app/commissions",
      } as any);
    },
    onSuccess: () => {
      toast.success("Marcada como paga");
      qc.invalidateQueries({ queryKey: ["commissions", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commissions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removida");
      qc.invalidateQueries({ queryKey: ["commissions", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const exportCsv = () => {
    const head = ["Funcionário", "Cliente", "Serviço", "Valor serviço", "Tipo", "Comissão", "Status", "Data", "Pago em"];
    const lines = rows.map((c) => [
      c.staff_name ?? "",
      c.customer_name ?? "",
      c.service_name ?? "",
      (c.service_amount_cents / 100).toFixed(2),
      c.commission_type === "fixed" ? "Fixo" : "Percentual",
      (c.commission_cents / 100).toFixed(2),
      STATUS[c.status]?.label ?? c.status,
      dateBR(c.occurred_at),
      c.paid_at ? dateBR(c.paid_at) : "",
    ]);
    const csv = [head, ...lines].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `comissoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const exportPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Comissões · ${activeCompany?.name ?? ""}`, 14, 16);
    doc.setFontSize(9);
    doc.text(
      `Total vendido: ${brl(totals.sold / 100)} · Comissões: ${brl(totals.comm / 100)} · Pendente: ${brl(
        totals.pending / 100,
      )} · Pago: ${brl(totals.paid / 100)}`,
      14,
      23,
    );
    autoTable(doc, {
      startY: 28,
      styles: { fontSize: 8 },
      head: [["Funcionário", "Cliente", "Serviço", "Valor", "Comissão", "Status", "Data"]],
      body: rows.map((c) => [
        c.staff_name ?? "",
        c.customer_name ?? "",
        c.service_name ?? "",
        brl(c.service_amount_cents / 100),
        brl(c.commission_cents / 100),
        STATUS[c.status]?.label ?? c.status,
        dateBR(c.occurred_at),
      ]),
    });
    doc.save(`comissoes-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Comissões</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Comissões geradas automaticamente ao concluir agendamentos."
              : "Suas comissões e histórico de pagamentos."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <FileDown className="h-4 w-4 mr-2" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Kpi label="Total vendido" value={brl(totals.sold / 100)} icon={<Wallet className="h-4 w-4" />} />
        <Kpi label="Total em comissão" value={brl(totals.comm / 100)} icon={<BadgePercent className="h-4 w-4" />} />
        <Kpi label="Pendente" value={brl(totals.pending / 100)} icon={<BadgePercent className="h-4 w-4" />} />
        <Kpi label="Pago" value={brl(totals.paid / 100)} icon={<CheckCheck className="h-4 w-4" />} />
        <Kpi label="Serviços" value={String(totals.count)} icon={<Users className="h-4 w-4" />} />
      </div>

      <Card className="print:hidden">
        <CardContent className="p-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          {isAdmin && (
            <div>
              <Label className="text-xs">Funcionário</Label>
              <Select value={staffFilter} onValueChange={setStaffFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Serviço</Label>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {services.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Cliente</Label>
            <Input value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} placeholder="Buscar…" />
          </div>
          <div>
            <Label className="text-xs">Data inicial</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Data final</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <p className="p-12 text-center text-muted-foreground">Carregando…</p>
          ) : !rows.length ? (
            <div className="p-12 text-center">
              <BadgePercent className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Nenhuma comissão no período.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  {isAdmin && <th className="p-3 font-medium">Funcionário</th>}
                  <th className="p-3 font-medium">Cliente</th>
                  <th className="p-3 font-medium">Serviço</th>
                  <th className="p-3 font-medium">Valor serviço</th>
                  <th className="p-3 font-medium">Comissão</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Data</th>
                  <th className="p-3 font-medium text-right print:hidden">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    {isAdmin && <td className="p-3">{c.staff_name ?? "—"}</td>}
                    <td className="p-3">{c.customer_name ?? "—"}</td>
                    <td className="p-3">{c.service_name ?? "—"}</td>
                    <td className="p-3">{brl(c.service_amount_cents / 100)}</td>
                    <td className="p-3 font-medium">
                      {brl(c.commission_cents / 100)}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({c.commission_type === "fixed" ? "fixo" : `${c.commission_value}%`})
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${STATUS[c.status]?.color ?? ""}`}>
                        {STATUS[c.status]?.label ?? c.status}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">{dateBR(c.occurred_at)}</td>
                    <td className="p-3 text-right print:hidden">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" title="Detalhes" onClick={() => setDetail(c)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <>
                            {c.status === "pending" && (
                              <Button size="icon" variant="ghost" title="Marcar como pago" onClick={() => markPaid.mutate([c.id])}>
                                <CheckCheck className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" title="Editar" onClick={() => setEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Excluir"
                              onClick={() => { if (confirm("Excluir esta comissão?")) del.mutate(c.id); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {isAdmin && rows.some((c) => c.status === "pending") && (
        <div className="flex justify-end print:hidden">
          <Button onClick={() => markPaid.mutate(rows.filter((c) => c.status === "pending").map((c) => c.id))}>
            <CheckCheck className="h-4 w-4 mr-2" /> Marcar filtradas como pagas
          </Button>
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Detalhes da comissão</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              <Detail label="Funcionário" value={detail.staff_name ?? "—"} />
              <Detail label="Cliente" value={detail.customer_name ?? "—"} />
              <Detail label="Serviço" value={detail.service_name ?? "—"} />
              <Detail label="Valor do serviço" value={brl(detail.service_amount_cents / 100)} />
              <Detail label="Tipo" value={detail.commission_type === "fixed" ? "Valor fixo" : "Percentual"} />
              <Detail
                label="Regra"
                value={detail.commission_type === "fixed" ? brl(Number(detail.commission_value)) : `${detail.commission_value}%`}
              />
              <Detail label="Comissão" value={brl(detail.commission_cents / 100)} />
              <Detail label="Status" value={STATUS[detail.status]?.label ?? detail.status} />
              <Detail label="Data / hora" value={new Date(detail.occurred_at).toLocaleString("pt-BR")} />
              <Detail label="Criada em" value={new Date(detail.created_at).toLocaleString("pt-BR")} />
              <Detail label="Paga em" value={detail.paid_at ? new Date(detail.paid_at).toLocaleString("pt-BR") : "—"} />
              {detail.notes && <Detail label="Observações" value={detail.notes} />}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Editar comissão</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select value={edit.commission_type} onValueChange={(v) => setEdit({ ...edit, commission_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{edit.commission_type === "fixed" ? "Valor (R$)" : "Percentual (%)"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={String(edit.commission_value)}
                  onChange={(e) => setEdit({ ...edit, commission_value: parseFloat(e.target.value || "0") })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button disabled={save.isPending} onClick={() => edit && save.mutate(edit)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
        <p className="mt-1 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-words">{value}</span>
    </div>
  );
}
