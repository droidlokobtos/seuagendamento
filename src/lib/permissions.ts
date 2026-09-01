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
  | "desempenho"
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
      { key: "desempenho", label: "Desempenho profissional" },
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
    desempenho: true,
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

export const ROUTE_PERMISSIONS: { prefix: string; key: PermissionKey }[] = [
  { prefix: "/app/operations", key: "agendamentos" },
  { prefix: "/app/cash", key: "caixa" },
  { prefix: "/app/expenses", key: "financeiro" },
  { prefix: "/app/audit", key: "financeiro" },
  { prefix: "/app/agenda", key: "agenda" },
  { prefix: "/app/blocks", key: "agenda" },
  { prefix: "/app/confirmations", key: "agendamentos" },
  { prefix: "/app/attendance", key: "agendamentos" },
  { prefix: "/app/customers", key: "clientes" },
  { prefix: "/app/loyalty", key: "clientes" },
  { prefix: "/app/rewards", key: "clientes" },
  { prefix: "/app/reviews", key: "clientes" },
  { prefix: "/app/birthdays", key: "clientes" },
  { prefix: "/app/campaigns", key: "clientes" },
  { prefix: "/app/services", key: "servicos" },
  { prefix: "/app/gallery", key: "servicos" },
  { prefix: "/app/plans", key: "servicos" },
  { prefix: "/app/procedures", key: "servicos" },
  { prefix: "/app/finances", key: "financeiro" },
  { prefix: "/app/payments", key: "financeiro" },
  { prefix: "/app/coupons", key: "financeiro" },
  { prefix: "/app/commissions", key: "comissoes" },
  { prefix: "/app/sales", key: "caixa" },
  { prefix: "/app/products", key: "estoque" },
  { prefix: "/app/reports", key: "relatorios" },
  { prefix: "/app/ai", key: "relatorios" },
  { prefix: "/app/users", key: "usuarios" },
  { prefix: "/app/staff", key: "configuracoes" },
  { prefix: "/app/settings", key: "configuracoes" },
  { prefix: "/app/whatsapp", key: "configuracoes" },
  { prefix: "/app/portal", key: "configuracoes" },
  { prefix: "/app/link", key: "configuracoes" },
];

const ROUTE_FEATURES: { prefix: string; feature: string }[] = [
  { prefix: "/app/portal", feature: "personalizacao" },
  { prefix: "/app/ai", feature: "relatorios_avancados" },
];

export function routePermission(pathname: string): PermissionKey | null {
  const match = ROUTE_PERMISSIONS.filter((r) => pathname.startsWith(r.prefix)).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];
  return match?.key ?? null;
}

export function routeFeature(pathname: string): string | null {
  const match = ROUTE_FEATURES.filter((r) => pathname.startsWith(r.prefix)).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];
  return match?.feature ?? null;
}
