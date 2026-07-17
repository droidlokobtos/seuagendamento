import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app/AppLayout";
import { useCompany } from "@/lib/company";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  inviteCompanyUser,
  listCompanyUsers,
  removeCompanyUser,
  updateCompanyUserRole,
} from "@/lib/team.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, UserPlus, Shield, User, Phone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/users")({
  component: UsersPage,
});

const ROLE_LABEL: Record<string, string> = {
  company_admin: "Administrador",
  staff: "Funcionário",
  receptionist: "Recepcionista",
  super_admin: "Super Admin",
  customer: "Cliente",
};
const ROLE_ICON: Record<string, any> = {
  company_admin: Shield,
  staff: User,
  receptionist: Phone,
};
const ROLE_DESC: Record<string, string> = {
  company_admin: "Acesso total: dashboard, financeiro, configurações e usuários.",
  staff: "Acessa apenas a agenda e clientes atribuídos a ele.",
  receptionist: "Gerencia agenda, clientes e vendas — sem acesso ao financeiro nem configurações.",
};

function UsersPage() {
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const qc = useQueryClient();
  const list = useServerFn(listCompanyUsers);
  const invite = useServerFn(inviteCompanyUser);
  const update = useServerFn(updateCompanyUserRole);
  const remove = useServerFn(removeCompanyUser);

  const companyId = activeCompany?.id;

  const { data = [], isLoading } = useQuery({
    queryKey: ["company-users", companyId],
    enabled: !!companyId,
    queryFn: () => list({ data: { companyId: companyId! } }),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", fullName: "", role: "staff" as const });

  const inviteMut = useMutation({
    mutationFn: () =>
      invite({
        data: { companyId: companyId!, email: form.email, fullName: form.fullName, role: form.role },
      }),
    onSuccess: (res: any) => {
      toast.success(res.wasInvited ? "Convite enviado por email" : "Usuário vinculado à empresa");
      setOpen(false);
      setForm({ email: "", fullName: "", role: "staff" });
      qc.invalidateQueries({ queryKey: ["company-users", companyId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao convidar"),
  });

  const updateMut = useMutation({
    mutationFn: (v: { membershipId: string; role: any }) =>
      update({ data: { companyId: companyId!, ...v } }),
    onSuccess: () => {
      toast.success("Função atualizada");
      qc.invalidateQueries({ queryKey: ["company-users", companyId] });
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

  if (!activeCompany) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Selecione uma empresa.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Usuários internos</h1>
            <p className="text-sm text-muted-foreground">
              Convide membros da equipe e defina o nível de acesso ao painel.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" /> Convidar usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar novo usuário</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome completo</Label>
                  <Input
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Maria da Silva"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="maria@email.com"
                  />
                </div>
                <div>
                  <Label>Função</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v: any) => setForm({ ...form, role: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company_admin">Administrador</SelectItem>
                      <SelectItem value="receptionist">Recepcionista</SelectItem>
                      <SelectItem value="staff">Funcionário</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ROLE_DESC[form.role]}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => inviteMut.mutate()}
                  disabled={!form.email || !form.fullName || inviteMut.isPending}
                >
                  {inviteMut.isPending ? "Enviando..." : "Enviar convite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Equipe ({data.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
            ) : data.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                Nenhum usuário. Convide o primeiro membro da equipe.
              </p>
            ) : (
              <div className="divide-y">
                {data.map((m: any) => {
                  const Icon = ROLE_ICON[m.role] ?? User;
                  const isMe = m.userId === user?.id;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 p-4 flex-wrap"
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {m.fullName || m.email || "Usuário"} {isMe && <Badge variant="secondary" className="ml-1">Você</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      </div>
                      <Select
                        value={m.role}
                        disabled={isMe || updateMut.isPending}
                        onValueChange={(v) =>
                          updateMut.mutate({ membershipId: m.id, role: v })
                        }
                      >
                        <SelectTrigger className="w-[170px] h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="company_admin">Administrador</SelectItem>
                          <SelectItem value="receptionist">Recepcionista</SelectItem>
                          <SelectItem value="staff">Funcionário</SelectItem>
                        </SelectContent>
                      </Select>
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
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
