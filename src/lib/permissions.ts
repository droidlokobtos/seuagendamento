export type PermissionKey =
  | "dashboard"
  | "agenda"
  | "agendamentos"
  | "clientes"
  | "clientes_cadastro"
  | "historico"
  | "financeiro"
  | "caixa"
  | "servicos"
  | "produtos"
  | "estoque"
  | "relatorios"
  | "comissoes"
  | "configuracoes"
  | "usuarios"
  | "excluir"
  | "editar"
  | "ver_contato_cliente";

export type PermissionGroup = {
  label: string;
  items: { key: PermissionKey; label: string; hint?: string }[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: "Operação",
    items: [
      { key: "dashboard", label: "Dashboard" },
      { key: "agenda", label: "Agenda" },
      { key: "agendamentos", label: "Agendamentos", hint: "Criar, remarcar e cancelar" },
      { key: "historico", label: "Histórico de atendimentos" },
    ],
  },
  {
    label: "Clientes",
    items: [
      { key: "clientes", label: "Clientes" },
      { key: "clientes_cadastro", label: "Cadastro de clientes" },
      { key: "ver_contato_cliente", label: "Ver telefone/contato do cliente" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { key: "financeiro", label: "Financeiro" },
      { key: "caixa", label: "Caixa / Vendas" },
      { key: "comissoes", label: "Comissões" },
      { key: "relatorios", label: "Relatórios" },
    ],
  },
  {
    label: "Catálogo e estoque",
    items: [
      { key: "servicos", label: "Serviços" },
      { key: "produtos", label: "Produtos" },
      { key: "estoque", label: "Estoque" },
    ],
  },
  {
    label: "Administração",
    items: [
      { key: "configuracoes", label: "Configurações" },
      { key: "usuarios", label: "Usuários" },
      { key: "editar", label: "Editar informações" },
      { key: "excluir", label: "Exclusão de registros" },
    ],
  },
];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key),
);

export type PermissionMap = Partial<Record<PermissionKey, boolean>>;

export const ROLE_PRESETS: Record<string, PermissionMap> = {
  company_admin: Object.fromEntries(ALL_PERMISSIONS.map((k) => [k, true])) as PermissionMap,
  receptionist: {
    dashboard: true,
    agenda: true,
    agendamentos: true,
    historico: true,
    clientes: true,
    clientes_cadastro: true,
    ver_contato_cliente: true,
    caixa: true,
    editar: true,
  },
  staff: {
    dashboard: true,
    agenda: true,
    historico: true,
    clientes: true,
    comissoes: true,
  },
};

export const ROLE_LABEL: Record<string, string> = {
  company_admin: "Administrador",
  receptionist: "Recepcionista",
  staff: "Profissional",
  super_admin: "Admin Master",
  customer: "Cliente",
};

export function hasPermission(
  role: string | null | undefined,
  permissions: PermissionMap | null | undefined,
  key: PermissionKey,
): boolean {
  if (role === "super_admin" || role === "company_admin") return true;
  return permissions?.[key] === true;
}
