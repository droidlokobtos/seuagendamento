import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Building2, LogIn, KeyRound, Trash2, Sparkles } from "lucide-react";
import { dateBR, slugify, statusLabel } from "@/lib/format";
import { toast } from "sonner";
import { startImpersonation } from "@/lib/impersonation";
import { useServerFn } from "@tanstack/react-start";
import { resetUserPassword, deleteCompany, createCompanyWithAdmin, setCompanyPlan } from "@/lib/admin-users.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/companies")({
  component: Companies,
});

function Companies() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState<{ email: string } | null>(null);
  const [delOpen, setDelOpen] = useState<{ id: string; name: string } | null>(null);
  const [planOpen, setPlanOpen] = useState<any | null>(null);
  const resetPw = useServerFn(resetUserPassword);
  const delCompany = useServerFn(deleteCompany);
  const createCompanyFn = useServerFn(createCompanyWithAdmin);
  const setPlanFn = useServerFn(setCompanyPlan);
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string | null; name: string } | null>(null);
  const { isSuperAdmin } = useAuth();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select(
          "id, name, slug, status, niche_id, email, created_at, next_due_at, monthly_fee, plan_code, is_trial, trial_ends_at, niches(name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () =>
      (await supabase.from("subscription_plans").select("code, name, monthly_cents").eq("active", true).order("sort_order"))
        .data ?? [],
  });

  const { data: niches = [] } = useQuery({
    queryKey: ["niches"],
    queryFn: async () => (await supabase.from("niches").select("id, name").order("name")).data ?? [],
  });

  const filtered = companies.filter((c: any) => {
    const matchQ = !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.slug?.toLowerCase().includes(q.toLowerCase());
    const matchS = statusFilter === "all" || c.status === statusFilter;
    return matchQ && matchS;
  });

  const createMutation = useMutation({
    mutationFn: async (v: NewCompanyInput) => {
      return await createCompanyFn({ data: v });
    },
    onSuccess: (res, v) => {
      toast.success("Empresa criada e admin configurado");
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
      setOpen(false);
      setCreatedInfo({ email: res.email, password: res.temp_password, name: v.name });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Empresas</h2>
          <p className="text-sm text-muted-foreground mt-1">Gerencie todos os clientes da plataforma.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nova empresa</Button>
          </DialogTrigger>
          <NewCompanyDialog niches={niches as any} onSubmit={(v) => createMutation.mutate(v)} busy={createMutation.isPending} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou slug…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="due_soon">Próximo venc.</SelectItem>
              <SelectItem value="overdue">Em atraso</SelectItem>
              <SelectItem value="suspended">Suspensas</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">Nenhuma empresa encontrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3 pl-6">Empresa</th>
                    <th className="text-left p-3">Nicho</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Próx. venc.</th>
                    <th className="text-left p-3">Criada</th>
                    <th className="text-right p-3 pr-6">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c: any) => {
                    const s = statusLabel[c.status] ?? { label: c.status, className: "bg-muted", dot: "bg-muted-foreground" };
                    return (
                      <tr key={c.id} className="border-t border-border/60 hover:bg-muted/30">
                        <td className="p-3 pl-6">
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">/{c.slug}</p>
                        </td>
                        <td className="p-3 text-muted-foreground">{c.niches?.name ?? "—"}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${s.className}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{dateBR(c.next_due_at)}</td>
                        <td className="p-3 text-muted-foreground">{dateBR(c.created_at)}</td>
                        <td className="p-3 pr-6 text-right space-x-2 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await startImpersonation({ id: c.id, name: c.name });
                              toast.success(`Entrando como admin de ${c.name}`);
                              void navigate({ to: "/app" });
                            }}
                          >
                            <LogIn className="h-3.5 w-3.5 mr-1.5" /> Entrar como admin
                          </Button>
                          {c.email && (
                            <Button size="sm" variant="ghost" onClick={() => setPwOpen({ email: c.email })}>
                              <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Resetar senha
                            </Button>
                          )}
                          {isSuperAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDelOpen({ id: c.id, name: c.name })}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!pwOpen} onOpenChange={(o) => !o && setPwOpen(null)}>
        {pwOpen && (
          <ResetPasswordDialog
            email={pwOpen.email}
            busy={false}
            onSubmit={async (pw) => {
              try {
                await resetPw({ data: { email: pwOpen.email, new_password: pw } });
                toast.success("Senha redefinida. O usuário deverá trocar no próximo login.");
                setPwOpen(null);
              } catch (e: any) {
                toast.error(e.message);
              }
            }}
          />
        )}
      </Dialog>

      <Dialog open={!!delOpen} onOpenChange={(o) => !o && setDelOpen(null)}>
        {delOpen && (
          <DeleteCompanyDialog
            name={delOpen.name}
            onConfirm={async () => {
              try {
                await delCompany({ data: { company_id: delOpen.id } });
                toast.success(`Empresa "${delOpen.name}" excluída com sucesso.`);
                setDelOpen(null);
                qc.invalidateQueries({ queryKey: ["admin-companies"] });
              } catch (e: any) {
                toast.error(e.message ?? "Erro ao excluir empresa.");
              }
            }}
          />
        )}
      </Dialog>

      <Dialog open={!!createdInfo} onOpenChange={(o) => !o && setCreatedInfo(null)}>
        {createdInfo && (
          <DialogContent>
            <DialogHeader><DialogTitle>Empresa criada</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <p>A empresa <b>{createdInfo.name}</b> foi criada com sucesso.</p>
              <div className="rounded-lg border p-3 bg-muted/40 space-y-1">
                <p><b>E-mail do admin:</b> {createdInfo.email}</p>
                {createdInfo.password ? (
                  <>
                    <p><b>Senha temporária:</b> <code className="bg-background px-2 py-0.5 rounded">{createdInfo.password}</code></p>
                    <p className="text-xs text-muted-foreground">Envie esses dados ao responsável. Ele será obrigado a trocar a senha no primeiro login.</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Este e-mail já possuía uma conta. O acesso à empresa foi vinculado à conta existente.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setCreatedInfo(null)}>Ok</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function ResetPasswordDialog({ email, onSubmit, busy }: { email: string; onSubmit: (pw: string) => void; busy: boolean }) {
  const [pw, setPw] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Redefinir senha</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Definir nova senha para <b>{email}</b>. O usuário será obrigado a trocá-la no próximo login.</p>
        <div>
          <Label>Nova senha (mín. 8 caracteres)</Label>
          <Input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="nova senha temporária" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(pw)} disabled={busy || pw.length < 8}>Redefinir</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function DeleteCompanyDialog({ name, onConfirm }: { name: string; onConfirm: () => Promise<void> }) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="text-destructive flex items-center gap-2">
          <Trash2 className="h-5 w-5" /> Excluir empresa
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <p className="text-sm">
          Tem certeza de que deseja excluir <b>{name}</b>? Esta ação é <b>permanente</b> e não poderá ser desfeita.
        </p>
        <p className="text-xs text-muted-foreground">
          Todos os dados relacionados (agendamentos, clientes, serviços, financeiro, estoque, fidelidade, etc.) serão removidos.
        </p>
        <div>
          <Label>Para confirmar, digite <b>EXCLUIR</b></Label>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="EXCLUIR" />
        </div>
      </div>
      <DialogFooter>
        <Button
          variant="destructive"
          disabled={busy || confirmText.trim().toUpperCase() !== "EXCLUIR"}
          onClick={async () => {
            setBusy(true);
            try { await onConfirm(); } finally { setBusy(false); }
          }}
        >
          {busy ? "Excluindo…" : "Excluir permanentemente"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

type NewCompanyInput = {
  name: string;
  owner_name: string;
  slug: string;
  niche_id: string;
  sub_niche_id: string | null;
  email: string;
  phone: string;
  temp_password: string;
  contracted_plan: string;
  status: "active" | "due_soon" | "overdue" | "suspended";
  next_due_at: string;
  admin_notes: string | null;
  monthly_fee: number;
};

function formatBrazilianMobile(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function NewCompanyDialog({
  niches,
  onSubmit,
  busy,
}: {
  niches: { id: string; name: string }[];
  onSubmit: (v: NewCompanyInput) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [niche, setNiche] = useState("");
  const [subNiche, setSubNiche] = useState<string>("");
  const [email, setEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState<NewCompanyInput["status"]>("active");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [fee, setFee] = useState("49.90");
  const [accepted, setAccepted] = useState(false);

  const { data: subNiches = [] } = useQuery({
    queryKey: ["sub-niches", niche],
    enabled: !!niche,
    queryFn: async () =>
      (await supabase.from("sub_niches" as any).select("id, name").eq("niche_id", niche).order("name")).data ?? [],
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Nova empresa</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Nome da empresa</Label>
          <Input value={name} onChange={(e) => { setName(e.target.value); setSlug(slugify(e.target.value)); }} placeholder="Ex.: Studio Bella" />
        </div>
        <div>
          <Label>Nome do proprietário</Label>
          <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} maxLength={160} placeholder="Nome completo" />
        </div>
        <div>
          <Label>Slug (URL pública)</Label>
          <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="studio-bella" />
        </div>
        <div>
          <Label>Nicho</Label>
          <Select value={niche} onValueChange={setNiche}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {niches.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Sub-nicho (opcional)</Label>
          <Select value={subNiche || "none"} onValueChange={(v) => setSubNiche(v === "none" ? "" : v)} disabled={!niche}>
            <SelectTrigger><SelectValue placeholder={niche ? "Selecione…" : "Escolha um nicho primeiro"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Nenhum —</SelectItem>
              {(subNiches as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>E-mail do proprietário</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dono@empresa.com" />
        </div>
        <div>
          <Label>Telefone/WhatsApp do proprietário</Label>
          <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(formatBrazilianMobile(e.target.value))} placeholder="(11) 99999-9999" maxLength={15} />
        </div>
        <div>
          <Label>Senha inicial</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={72} autoComplete="new-password" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Plano contratado</Label>
            <Input value={plan} onChange={(e) => setPlan(e.target.value)} maxLength={100} placeholder="Ex.: Profissional" />
          </div>
          <div>
            <Label>Status da empresa</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as NewCompanyInput["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativa</SelectItem>
                <SelectItem value="due_soon">Próximo vencimento</SelectItem>
                <SelectItem value="overdue">Em atraso</SelectItem>
                <SelectItem value="suspended">Suspensa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Data de vencimento</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <Label>Mensalidade (R$)</Label>
          <Input type="number" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} />
        </div>
        <div>
          <Label>Observações (opcional)</Label>
          <textarea className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </div>
        <label className="flex items-start gap-2 text-xs text-muted-foreground leading-snug pt-1">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>
            O responsável pela empresa concorda com os{" "}
            <a href="/termos" target="_blank" rel="noreferrer" className="text-primary underline hover:no-underline">
              Termos de Uso e Contratação
            </a>{" "}
            da plataforma.
          </span>
        </label>
      </div>
      <DialogFooter>
        <Button
          onClick={() => onSubmit({
            name, owner_name: ownerName, slug, niche_id: niche, sub_niche_id: subNiche || null,
            email, phone, temp_password: password, contracted_plan: plan, status,
            next_due_at: dueDate, admin_notes: notes.trim() || null, monthly_fee: Number(fee),
          })}
          disabled={busy || !name || !ownerName || !slug || !niche || !email || phone.replace(/\D/g, "").length !== 11 || password.length < 8 || !plan || !dueDate || !accepted}
        >
          {busy ? "Criando…" : "Criar empresa"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
