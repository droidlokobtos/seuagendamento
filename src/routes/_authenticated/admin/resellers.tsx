import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Handshake, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createReseller } from "@/lib/resellers.functions";
import { brl, dateBR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/resellers")({
  component: ResellersAdmin,
});
const empty = {
  name: "",
  email: "",
  phone: "",
  commission_percent: 10,
  payout_day: 10,
  pix_key: "",
  password: "",
};
function ResellersAdmin() {
  const qc = useQueryClient();
  const createFn = useServerFn(createReseller);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [reseller, setReseller] = useState("");
  const [company, setCompany] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-resellers"],
    queryFn: async () => {
      const [{ data: r }, { data: s }, { data: c }] = await Promise.all([
        (supabase.from as any)("resellers").select("*").order("created_at", { ascending: false }),
        (supabase.from as any)("reseller_sales")
          .select("*,companies(name),resellers(name)")
          .order("created_at", { ascending: false }),
        supabase.from("companies").select("id,name").order("name"),
      ]);
      return { resellers: r ?? [], sales: s ?? [], companies: c ?? [] };
    },
  });
  const createM = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: (result) => {
      toast.success(
        result.reusedExistingAccount
          ? "Revendedor vinculado à conta existente. A senha atual foi mantida."
          : "Revendedor cadastrado e acesso criado.",
      );
      setOpen(false);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["admin-resellers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const linkM = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.rpc as any)("link_reseller_company", {
        _reseller_id: reseller,
        _company_id: company,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda vinculada");
      setCompany("");
      qc.invalidateQueries({ queryKey: ["admin-resellers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const pay = async (id: string) => {
    const ref = window.prompt("Referência do repasse (opcional)") ?? "";
    const { error } = await (supabase.rpc as any)("mark_reseller_commission_paid", {
      _sale_id: id,
      _reference: ref,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Repasse confirmado");
      qc.invalidateQueries({ queryKey: ["admin-resellers"] });
    }
  };
  const sales = data?.sales ?? [];
  const pending = sales
    .filter((s: any) => s.status === "earned")
    .reduce((n: number, s: any) => n + Number(s.commission_amount || 0), 0);
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
            Canal comercial
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <Handshake className="h-6 w-6" />
            Revendedores
          </h2>
          <p className="text-sm text-muted-foreground">
            Cadastre parceiros, vincule vendas e controle repasses.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo revendedor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar revendedor</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="E-mail">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="Comissão (%)">
                <Input
                  type="number"
                  value={form.commission_percent}
                  onChange={(e) => setForm({ ...form, commission_percent: Number(e.target.value) })}
                />
              </Field>
              <Field label="Dia do repasse">
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={form.payout_day}
                  onChange={(e) => setForm({ ...form, payout_day: Number(e.target.value) })}
                />
              </Field>
              <Field label="Chave PIX">
                <Input
                  value={form.pix_key}
                  onChange={(e) => setForm({ ...form, pix_key: e.target.value })}
                />
              </Field>
              <Field label="Senha inicial">
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Se o e-mail já possuir uma conta sem vínculo, a senha atual será mantida.
                </p>
              </Field>
            </div>
            <Button onClick={() => createM.mutate()} disabled={createM.isPending}>
              Cadastrar e criar acesso
            </Button>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Revendedores ativos"
          value={(data?.resellers ?? []).filter((r: any) => r.active).length}
        />
        <Stat label="Vendas vinculadas" value={sales.length} />
        <Stat label="Aguardando repasse" value={brl(pending)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vincular nova venda</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Select value={reseller} onValueChange={setReseller}>
            <SelectTrigger className="sm:w-72">
              <SelectValue placeholder="Selecione o revendedor" />
            </SelectTrigger>
            <SelectContent>
              {(data?.resellers ?? [])
                .filter((r: any) => r.active)
                .map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} · {r.commission_percent}%
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={company} onValueChange={setCompany}>
            <SelectTrigger className="sm:w-72">
              <SelectValue placeholder="Empresa vendida" />
            </SelectTrigger>
            <SelectContent>
              {(data?.companies ?? []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!reseller || !company || linkM.isPending}
            onClick={() => linkM.mutate()}
          >
            Vincular venda
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comissões e repasses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Revendedor</th>
                  <th className="p-3 text-left">Empresa</th>
                  <th className="p-3 text-left">Comissão</th>
                  <th className="p-3 text-left">Valor</th>
                  <th className="p-3 text-left">Repasse</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s: any) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-3 font-medium">{s.resellers?.name}</td>
                    <td className="p-3">{s.companies?.name}</td>
                    <td className="p-3">{s.commission_percent}%</td>
                    <td className="p-3 font-semibold">
                      {s.commission_amount ? brl(Number(s.commission_amount)) : "—"}
                    </td>
                    <td className="p-3">
                      {s.scheduled_payout_date
                        ? dateBR(s.scheduled_payout_date)
                        : "Após 1º pagamento"}
                    </td>
                    <td className="p-3 text-right">
                      {s.status === "earned" ? (
                        <Button size="sm" onClick={() => pay(s.id)}>
                          <Wallet className="mr-2 h-4 w-4" />
                          Marcar pago
                        </Button>
                      ) : (
                        <Badge variant="outline">
                          {(
                            {
                              pending: "Aguardando mensalidade",
                              paid: "Pago",
                              cancelled: "Cancelado",
                            } as any
                          )[s.status] ?? s.status}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
function Field({ label, children }: any) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Stat({ label, value }: any) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
