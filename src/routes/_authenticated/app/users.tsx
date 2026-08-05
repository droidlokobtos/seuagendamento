import { createFileRoute } from "@tanstack/react-router";
import { useCompany } from "@/lib/company";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createCompanyUser,
  listCompanyUsers,
  removeCompanyUser,
  setCompanyUserPassword,
  updateCompanyUser,
} from "@/lib/team.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, UserPlus, Shield, User, Phone, KeyRound, History } from "lucide-react";
import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_LABEL,
  ROLE_PRESETS,
  type PermissionKey,
  type PermissionMap,
} from "@/lib/permissions";
import { usePermissions } from "@/lib/use-permissions";

export const Route = createFileRoute("/_authenticated/app/users")({
  component: UsersPage,
});

const ROLE_ICON: Record<string, any> = {
  company_admin: Shield,
  staff: User,
  receptionist: Phone,
};
const ROLE_DESC: Record<string, string> = {
  company_admin: "Acesso total ao sistema, usuários, permissões e financeiro.",
  receptionist: "Painel da recepção: agenda, clientes, check-in e caixa (se autorizado).",
  staff: "Painel do profissional: sua agenda, seus atendimentos e comissões.",
};

type FormState = {
  email: string;
  password: string;
  fullName: string;
  jobTitle: string;
  role: "company_admin" | "receptionist" | "staff";
  permissions: PermissionMap;
  staffId: string | null;
};

const emptyForm = (): FormState => ({
  email: "",
  password: "",
  fullName: "",
  jobTitle: "",
  role: "staff",
  permissions: { ...ROLE_PRESETS.staff },
  staffId: null,
});

function UsersPage() {
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const qc = useQueryClient();
  const list = useServerFn(listCompanyUsers);
  const create = useServerFn(createCompanyUser);
  const update = useServerFn(updateCompanyUser);
  const setPassword = useServerFn(setCompanyUserPassword);
  const remove = useServerFn(removeCompanyUser);

  const companyId = activeCompany?.id;

  const { data = [], isLoading } = useQuery({
    queryKey: ["company-users", companyId],
    enabled: !!companyId && isAdmin,
    queryFn: () => list({ data: { companyId: companyId! } }) as any,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-simple", companyId],
    enabled: !!companyId && isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("staff")
        .select("id,name")
        .eq("company_id", companyId!)
        .order("name");
      return data ?? [];
    },
  });

  const { data: auditRows = [] } = useQuery({
    queryKey: ["user-audit", companyId],
    enabled: !!companyId && isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_audit_log")
        .select("id,action,entity,entity_id,metadata,created_at,user_id")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pwTarget, setPwTarget] = useState<any | null>(null);
  const [newPw, setNewPw] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        email: editing.email ?? "",
        password: "",
        fullName: editing.fullName ?? "",
        jobTitle: editing.jobTitle ?? "",
        role: editing.role,
        permissions: { ...(editing.permissions ?? {}) },
        staffId: editing.staffId ?? null,
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, editing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) {
        return update({
          data: {
            companyId: companyId!,
            membershipId: editing.id,
            role: form.role,
            jobTitle: form.jobTitle || null,
            permissions: form.permissions as Record<string, boolean>,
            staffId: form.staffId,
          },
        });
      }
      return create({
        data: {
          companyId: companyId!,
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          jobTitle: form.jobTitle || null,
          role: form.role,
          permissions: form.permissions as Record<string, boolean>,
          staffId: form.staffId,
        },
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Usuário atualizado" : "Usuário cadastrado — já pode acessar o sistema");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["company-users", companyId] });
      qc.invalidateQueries({ queryKey: ["user-audit", companyId] });
      qc.invalidateQueries({ queryKey: ["my-companies"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const toggleActive = useMutation({
    mutationFn: (v: { membershipId: string; active: boolean }) =>
      update({ data: { companyId: companyId!, membershipId: v.membershipId, active: v.active } }),
    onSuccess: () => {
      toast.success("Situação atualizada");
      qc.invalidateQueries({ queryKey: ["company-users", companyId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const pwMut = useMutation({
    mutationFn: () =>
      setPassword({ data: { companyId: companyId!, membershipId: pwTarget.id, password: newPw } }),
    onSuccess: () => {
      toast.success("Senha redefinida");
      setPwTarget(null);
      setNewPw("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const removeMut = useMutation({
    mutationFn: (membershipId: string) =>
      remove({ data: { companyId: companyId!, membershipId } }),
    onSuccess: () => {
      toast.success("Usuário removido da empresa");
      qc.invalidateQueries({ queryKey: ["company-users", companyId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  if (!activeCompany) return <p className="text-muted-foreground">Selecione uma empresa.</p>;
  if (!isAdmin)
    return (
      <Card className="max-w-lg">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Apenas o administrador da empresa pode gerenciar usuários e permissões.
        </CardContent>
      </Card>
    );

  const setPerm = (key: PermissionKey, value: boolean) =>
    setForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: value } }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Usuários e permissões</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre a equipe com e-mail e senha — o acesso é imediato, sem convite por e-mail.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <UserPlus className="h-4 w-4 mr-2" /> Novo usuário
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["company_admin", "receptionist", "staff"] as const).map((r) => {
          const Icon = ROLE_ICON[r];
          return (
            <Card key={r}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" /> {ROLE_LABEL[r]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{ROLE_DESC[r]}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team">Equipe ({data.length})</TabsTrigger>
          <TabsTrigger value="audit">
            <History className="h-4 w-4 mr-1" /> Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
              ) : data.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Nenhum usuário cadastrado ainda.
                </p>
              ) : (
                <div className="divide-y">
                  {data.map((m: any) => {
                    const Icon = ROLE_ICON[m.role] ?? User;
                    const isMe = m.userId === user?.id;
                    return (
                      <div key={m.id} className="flex items-center gap-3 p-4 flex-wrap">
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {m.fullName || m.email || "Usuário"}{" "}
                            {isMe && <Badge variant="secondary" className="ml-1">Você</Badge>}
                            {!m.active && <Badge variant="destructive" className="ml-1">Inativo</Badge>}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {m.email} · {ROLE_LABEL[m.role] ?? m.role}
                            {m.jobTitle ? ` · ${m.jobTitle}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 mr-2">
                            <Switch
                              checked={m.active}
                              disabled={isMe}
                              onCheckedChange={(v) =>
                                toggleActive.mutate({ membershipId: m.id, active: v })
                              }
                            />
                            <span className="text-xs text-muted-foreground hidden sm:inline">Ativo</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditing(m);
                              setOpen(true);
                            }}
                          >
                            Permissões
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setPwTarget(m)}>
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isMe}
                            onClick={() => {
                              if (confirm("Remover este usuário da empresa?")) removeMut.mutate(m.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardContent className="p-0">
              {auditRows.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nenhuma ação registrada ainda.</p>
              ) : (
                <div className="divide-y">
                  {auditRows.map((a: any) => (
                    <div key={a.id} className="p-4 text-sm">
                      <div className="flex justify-between gap-3 flex-wrap">
                        <span className="font-medium">{a.action}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground break-all">
                        {a.entity} {a.entity_id ? `· ${a.entity_id}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Nome completo</Label>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Maria da Silva"
                  disabled={!!editing}
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="maria@email.com"
                  disabled={!!editing}
                />
              </div>
              {!editing && (
                <div>
                  <Label>Senha de acesso</Label>
                  <Input
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
              )}
              <div>
                <Label>Cargo / Função</Label>
                <Input
                  value={form.jobTitle}
                  onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                  placeholder="Recepcionista, Cabeleireira..."
                />
              </div>
              <div>
                <Label>Perfil de acesso</Label>
                <Select
                  value={form.role}
                  onValueChange={(v: any) =>
                    setForm((f) => ({ ...f, role: v, permissions: { ...ROLE_PRESETS[v] } }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company_admin">Administrador</SelectItem>
                    <SelectItem value="receptionist">Recepcionista</SelectItem>
                    <SelectItem value="staff">Profissional</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">{ROLE_DESC[form.role]}</p>
              </div>
              {form.role === "staff" && (
                <div>
                  <Label>Vincular ao profissional</Label>
                  <Select
                    value={form.staffId ?? "none"}
                    onValueChange={(v) => setForm({ ...form, staffId: v === "none" ? null : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não vinculado</SelectItem>
                      {staffList.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Necessário para exibir a agenda e as comissões dele.
                  </p>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Permissões de acesso</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        permissions: Object.fromEntries(ALL_PERMISSIONS.map((k) => [k, true])),
                      }))
                    }
                  >
                    Marcar tudo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, permissions: {} }))}
                  >
                    Limpar
                  </Button>
                </div>
              </div>
              {form.role === "company_admin" ? (
                <p className="text-xs text-muted-foreground mt-2">
                  Administradores têm acesso total automaticamente.
                </p>
              ) : (
                <div className="mt-2 space-y-4">
                  {PERMISSION_GROUPS.map((g) => (
                    <div key={g.label}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase">{g.label}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {g.items.map((it) => (
                          <label
                            key={it.key}
                            className="flex items-center justify-between gap-2 rounded-lg border p-2"
                          >
                            <span className="text-sm">
                              {it.label}
                              {it.hint && (
                                <span className="block text-xs text-muted-foreground">{it.hint}</span>
                              )}
                            </span>
                            <Switch
                              checked={form.permissions[it.key] === true}
                              onCheckedChange={(v) => setPerm(it.key, v)}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={
                saveMut.isPending ||
                (!editing && (!form.email || !form.fullName || form.password.length < 8))
              }
            >
              {saveMut.isPending ? "Salvando..." : editing ? "Salvar" : "Cadastrar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwTarget} onOpenChange={(v) => { if (!v) setPwTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nova senha para {pwTarget?.email}</Label>
            <Input value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Mínimo 8 caracteres" />
          </div>
          <DialogFooter>
            <Button onClick={() => pwMut.mutate()} disabled={newPw.length < 8 || pwMut.isPending}>
              {pwMut.isPending ? "Salvando..." : "Redefinir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
