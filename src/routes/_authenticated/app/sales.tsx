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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BadgeCheck, Download, Plus, Receipt, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { dateBR, saoPauloDate, saoPauloDateAddDays, saoPauloDayStartIso } from "@/lib/format";
import {
  downloadCSV,
  effectivePriceCents,
  money,
  toCents,
  type Product,
  type SaleItem,
  type SalePayment,
} from "@/lib/commerce";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/sales")({
  component: SalesPage,
  head: () => ({
    meta: [
      { title: "Vendas e PDV · Produtos e serviços avulsos" },
      {
        name: "description",
        content:
          "Registre vendas de produtos e serviços avulsos com múltiplas formas de pagamento, baixa automática de estoque e lançamento financeiro.",
      },
      { property: "og:title", content: "Vendas e PDV" },
      {
        property: "og:description",
        content: "Registro de vendas com baixa de estoque e integração financeira.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Sale = {
  id: string;
  status: string;
  customer_id: string | null;
  staff_id: string | null;
  subtotal_cents: number;
  discount_cents: number;
  surcharge_cents: number;
  total_cents: number;
  notes: string | null;
  occurred_at: string;
  created_by_name: string | null;
};

type SellablePlan = {
  id: string;
  name: string;
  kind: "plan" | "package";
  price_cents: number;
  promo_price_cents: number | null;
  plan_services: { service_id: string; sessions: number; services: { name: string } | null }[];
};

const normalizeSearch = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

function SalesPage() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const from = `${month}-01T00:00:00`;
  const to = new Date(
    new Date(`${month}-01`).getFullYear(),
    new Date(`${month}-01`).getMonth() + 1,
    1,
  ).toISOString();

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales", companyId, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .eq("company_id", companyId)
        .gte("occurred_at", from)
        .lt("occurred_at", to)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Sale[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services-simple", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id,name,price_cents")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-simple", companyId],
    queryFn: async () => {
      const all: any[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("customers")
          .select("id,name,phone,whatsapp,email")
          .eq("company_id", companyId)
          .order("name")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        all.push(...(data ?? []));
        if (!data || data.length < pageSize) break;
      }
      return all;
    },
  });

  const { data: packages = [] } = useQuery({
    queryKey: ["sales-plans", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select(
          "id,name,kind,price_cents,promo_price_cents,plan_services(service_id,sessions,services(name))",
        )
        .eq("company_id", companyId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as SellablePlan[];
    },
  });

  const { data: options = [] } = useQuery({
    queryKey: ["payment_options", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_options")
        .select("id,name")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const done = sales.filter((s) => s.status === "completed");
    return {
      count: done.length,
      revenue: done.reduce((s, x) => s + x.total_cents, 0),
      ticket: done.length
        ? Math.round(done.reduce((s, x) => s + x.total_cents, 0) / done.length)
        : 0,
    };
  }, [sales]);

  const create = useMutation({
    mutationFn: async (v: {
      items: SaleItem[];
      payments: SalePayment[];
      customer_id: string | null;
      discount_cents: number;
      surcharge_cents: number;
      notes: string;
      appointment_id: string | null;
    }) => {
      const { data, error } = await (supabase as any).rpc("register_sale_with_credits", {
        _company_id: companyId,
        _customer_id: v.customer_id,
        _items: v.items,
        _payments: v.payments,
        _discount_cents: v.discount_cents,
        _surcharge_cents: v.surcharge_cents,
        _notes: v.notes || null,
        _appointment_id: v.appointment_id,
      });
      if (error) throw error;
      return data as { credits_cents?: number; total_cents?: number };
    },
    onSuccess: (result) => {
      toast.success(
        Number(result?.credits_cents ?? 0) > 0
          ? `Venda registrada · ${money(Number(result.credits_cents))} cobertos pelo pacote`
          : "Venda registrada",
      );
      qc.invalidateQueries({ queryKey: ["sales", companyId] });
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      qc.invalidateQueries({ queryKey: ["finances", companyId] });
      qc.invalidateQueries({ queryKey: ["customer-plans", companyId] });
      qc.invalidateQueries({ queryKey: ["sale-customer-credits", companyId] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await (supabase as any).rpc("cancel_sale_with_reversal", {
        _sale_id: id,
        _reason: reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda cancelada e créditos/estoque estornados");
      qc.invalidateQueries({ queryKey: ["sales", companyId] });
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      qc.invalidateQueries({ queryKey: ["finances", companyId] });
      qc.invalidateQueries({ queryKey: ["customer-plans", companyId] });
      qc.invalidateQueries({ queryKey: ["sale-customer-credits", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const exportCSV = () => {
    downloadCSV(`vendas-${month}.csv`, [
      ["Data", "Status", "Subtotal", "Desconto", "Acréscimo", "Total"],
      ...sales.map((s) => [
        dateBR(s.occurred_at),
        s.status,
        money(s.subtotal_cents),
        money(s.discount_cents),
        money(s.surcharge_cents),
        money(s.total_cents),
      ]),
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Vendas</h1>
          <p className="text-sm text-muted-foreground">
            Produtos e serviços avulsos com baixa de estoque e lançamento financeiro automáticos.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40"
          />
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" /> Exportar
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova venda
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Kpi
          label="Vendas no mês"
          value={String(totals.count)}
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <Kpi
          label="Faturamento"
          value={money(totals.revenue)}
          icon={<Receipt className="h-5 w-5" />}
          tone="text-emerald-600"
        />
        <Kpi
          label="Ticket médio"
          value={money(totals.ticket)}
          icon={<Receipt className="h-5 w-5" />}
          tone="text-primary"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Carregando…</div>
          ) : !sales.length ? (
            <div className="p-12 text-center text-muted-foreground">Sem vendas neste mês.</div>
          ) : (
            <div className="divide-y">
              {sales.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {money(s.total_cents)}
                      {s.discount_cents > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · desc. {money(s.discount_cents)}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {dateBR(s.occurred_at)}
                      {s.created_by_name ? ` · Registrada por ${s.created_by_name}` : ""}
                      {s.notes ? ` · ${s.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className={
                        s.status === "completed"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : s.status === "cancelled"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"
                            : ""
                      }
                    >
                      {s.status === "completed"
                        ? "Concluída"
                        : s.status === "cancelled"
                          ? "Cancelada"
                          : "Rascunho"}
                    </Badge>
                    {s.status === "completed" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (
                            !confirm(
                              "Cancelar esta venda e estornar créditos, estoque e financeiro?",
                            )
                          )
                            return;
                          cancel.mutate({
                            id: s.id,
                            reason: prompt("Motivo do cancelamento:") ?? "",
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <SaleDialog
            products={products as Product[]}
            services={services as any[]}
            packages={packages}
            customers={customers as any[]}
            options={options as any[]}
            companyId={companyId}
            loading={create.isPending}
            onSave={(v) => create.mutate(v)}
          />
        )}
      </Dialog>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className={tone}>{icon}</span>
        </div>
        <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function SaleDialog({
  products,
  services,
  packages,
  customers,
  options,
  companyId,
  onSave,
  loading,
}: {
  products: Product[];
  services: any[];
  packages: SellablePlan[];
  customers: any[];
  options: any[];
  companyId: string;
  loading: boolean;
  onSave: (v: {
    items: SaleItem[];
    payments: SalePayment[];
    customer_id: string | null;
    discount_cents: number;
    surcharge_cents: number;
    notes: string;
    appointment_id: string | null;
  }) => void;
}) {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [payments, setPayments] = useState<SalePayment[]>([]);
  const [customer, setCustomer] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [appointment, setAppointment] = useState("");
  const [discount, setDiscount] = useState(0);
  const [surcharge, setSurcharge] = useState(0);
  const [notes, setNotes] = useState("");
  const [q, setQ] = useState("");

  const selectedCustomer = useMemo(
    () => customers.find((entry) => entry.id === customer) ?? null,
    [customer, customers],
  );
  const customerResults = useMemo(() => {
    const term = normalizeSearch(customerSearch);
    if (!term) return selectedCustomer ? [] : customers.slice(0, 100);
    return customers
      .filter((entry) =>
        [entry.name, entry.phone, entry.whatsapp, entry.email]
          .map(normalizeSearch)
          .some((value) => value.includes(term)),
      )
      .slice(0, 100);
  }, [customerSearch, customers, selectedCustomer]);

  const { data: customerCredits = [] } = useQuery({
    enabled: !!customer,
    queryKey: ["sale-customer-credits", companyId, customer],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_plans")
        .select(
          "id,plan_name,expires_at,customer_plan_services(id,service_id,service_name,sessions_total,sessions_used)",
        )
        .eq("company_id", companyId)
        .eq("customer_id", customer)
        .eq("status", "active")
        .or(`expires_at.is.null,expires_at.gte.${saoPauloDate()}`)
        .order("expires_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: customerAppointments = [] } = useQuery({
    enabled: !!customer,
    queryKey: ["sale-customer-appointments", companyId, customer],
    queryFn: async () => {
      const today = saoPauloDate();
      const { data, error } = await supabase
        .from("appointments")
        .select("id,starts_at,status,appointment_services(service_id,services(name))")
        .eq("company_id", companyId)
        .eq("customer_id", customer)
        .gte("starts_at", saoPauloDayStartIso(saoPauloDateAddDays(-1, today)))
        .lt("starts_at", saoPauloDayStartIso(saoPauloDateAddDays(61, today)))
        .order("starts_at");
      if (error) throw error;
      const closed = new Set([
        "completed",
        "cancelled",
        "cancelled_by_customer",
        "cancelled_by_company",
        "no_show",
      ]);
      return (data ?? []).filter((row: any) => !closed.has(String(row.status)));
    },
  });

  const selectedAppointment = useMemo(
    () => (customerAppointments as any[]).find((row) => row.id === appointment) ?? null,
    [appointment, customerAppointments],
  );
  const appointmentServiceIds = useMemo(
    () =>
      new Set<string>(
        (selectedAppointment?.appointment_services ?? []).map((row: any) => row.service_id),
      ),
    [selectedAppointment],
  );

  const creditBalance = useMemo(() => {
    const map = new Map<string, number>();
    for (const plan of customerCredits as any[]) {
      for (const balance of plan.customer_plan_services ?? []) {
        const available = Math.max(
          0,
          Number(balance.sessions_total ?? 0) - Number(balance.sessions_used ?? 0),
        );
        map.set(balance.service_id, (map.get(balance.service_id) ?? 0) + available);
      }
    }
    return map;
  }, [customerCredits]);

  const sellable = useMemo(
    () => products.filter((p) => (p.scope ?? "sale") === "sale"),
    [products],
  );
  const results = useMemo(() => {
    const t = normalizeSearch(q);
    if (!t) {
      return packages.slice(0, 12).map((plan) => ({
        kind: "package" as const,
        id: plan.id,
        name: plan.name,
        cents:
          plan.promo_price_cents && plan.promo_price_cents > 0
            ? plan.promo_price_cents
            : plan.price_cents,
        cost: 0,
      }));
    }
    return [
      ...sellable
        .filter((p) =>
          [p.name, p.barcode, p.sku, p.internal_code].some((v) => normalizeSearch(v).includes(t)),
        )
        .slice(0, 12)
        .map((p) => ({
          kind: "product" as const,
          id: p.id,
          name: p.name,
          cents: effectivePriceCents(p),
          cost: Number(p.avg_cost || p.cost_price),
        })),
      ...services
        .filter(
          (s) =>
            normalizeSearch(s.name).includes(t) &&
            (!appointment || appointmentServiceIds.has(s.id)),
        )
        .slice(0, 12)
        .map((s) => ({
          kind: "service" as const,
          id: s.id,
          name: s.name,
          cents: Number(s.price_cents ?? 0),
          cost: 0,
        })),
      ...packages
        .filter((plan) => normalizeSearch(plan.name).includes(t))
        .slice(0, 12)
        .map((plan) => ({
          kind: "package" as const,
          id: plan.id,
          name: plan.name,
          cents:
            plan.promo_price_cents && plan.promo_price_cents > 0
              ? plan.promo_price_cents
              : plan.price_cents,
          cost: 0,
        })),
    ];
  }, [q, sellable, services, packages, appointment, appointmentServiceIds]);

  const add = (r: {
    kind: "product" | "service" | "package";
    id: string;
    name: string;
    cents: number;
    cost: number;
  }) => {
    if (r.kind === "package" && !customer) {
      toast.error("Selecione o cliente antes de adicionar um plano ou pacote.");
      return;
    }
    setItems((prev) => {
      const i = prev.findIndex((x) =>
        r.kind === "product"
          ? x.product_id === r.id
          : r.kind === "service"
            ? x.service_id === r.id
            : x.plan_id === r.id,
      );
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          kind: r.kind,
          product_id: r.kind === "product" ? r.id : null,
          service_id: r.kind === "service" ? r.id : null,
          plan_id: r.kind === "package" ? r.id : null,
          name: r.name,
          quantity: 1,
          unit_price_cents: r.cents,
          discount_cents: 0,
          total_cents: r.cents,
          unit_cost: r.cost,
        },
      ];
    });
    setQ("");
  };

  const creditPreview = useMemo(() => {
    const remaining = new Map(creditBalance);
    return items.map((item) => {
      if (item.kind !== "service" || !item.service_id) return 0;
      const available = remaining.get(item.service_id) ?? 0;
      const used = Math.min(Math.max(0, Math.floor(item.quantity)), available);
      remaining.set(item.service_id, available - used);
      return used;
    });
  }, [items, creditBalance]);
  const hasServiceOutsideAppointment =
    !!appointment &&
    items.some(
      (item) => item.kind === "service" && !appointmentServiceIds.has(item.service_id ?? ""),
    );
  const subtotal = items.reduce(
    (sum, item) => sum + Math.max(0, Math.round(item.quantity * item.unit_price_cents)),
    0,
  );
  const packageCreditCents = items.reduce(
    (sum, item, index) => sum + creditPreview[index] * item.unit_price_cents,
    0,
  );
  const itemDiscountCents = items.reduce(
    (sum, item) => sum + Math.max(0, item.discount_cents || 0),
    0,
  );
  const total = Math.max(
    0,
    subtotal - packageCreditCents - itemDiscountCents - toCents(discount) + toCents(surcharge),
  );
  const paid = payments.reduce((s, p) => s + p.amount_cents, 0);
  const remaining = total - paid;

  const addPayment = () => {
    const opt = options[0];
    setPayments([
      ...payments,
      {
        payment_option_id: opt?.id ?? null,
        method_name: opt?.name ?? "Dinheiro",
        amount_cents: Math.max(0, remaining),
        installments: 1,
      },
    ]);
  };

  return (
    <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Nova venda</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Cliente</Label>
          <p className="mb-2 text-xs text-muted-foreground">
            Pesquise por nome, telefone, WhatsApp ou e-mail. O sistema verificará os créditos do
            pacote automaticamente.
          </p>
          {selectedCustomer && (
            <div className="mb-2 flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{selectedCustomer.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {selectedCustomer.whatsapp ||
                    selectedCustomer.phone ||
                    selectedCustomer.email ||
                    "Cliente cadastrado"}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  setCustomer("");
                  setCustomerSearch("");
                  setAppointment("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Input
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder={selectedCustomer ? "Trocar cliente…" : "Digite nome, telefone ou e-mail…"}
            autoComplete="off"
          />
          {customerResults.length > 0 && (
            <div className="mt-1 max-h-52 overflow-y-auto rounded-lg border bg-background shadow-sm">
              {customerResults.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left last:border-0 hover:bg-muted"
                  onClick={() => {
                    setCustomer(entry.id);
                    setCustomerSearch("");
                    setAppointment("");
                  }}
                >
                  <span className="truncate text-sm">{entry.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {entry.whatsapp || entry.phone || entry.email || ""}
                  </span>
                </button>
              ))}
            </div>
          )}
          {customerSearch.trim() && customerResults.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Nenhum contato encontrado.</p>
          )}
        </div>

        {customer && (
          <div>
            <Label>Agendamento relacionado</Label>
            <Select
              value={appointment || "none"}
              onValueChange={(value) => setAppointment(value === "none" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Venda avulsa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Venda avulsa, sem agendamento</SelectItem>
                {(customerAppointments as any[]).map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {new Date(row.starts_at).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {(row.appointment_services ?? [])
                      .map((service: any) => service.services?.name)
                      .filter(Boolean)
                      .join(", ") || "Atendimento"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Ao vincular, o crédito será reservado uma única vez e não será descontado novamente
              quando o atendimento for concluído.
            </p>
          </div>
        )}

        <div>
          <Label>Adicionar item</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar produto ou serviço…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {results.length > 0 && (
            <div className="mt-1 rounded-md border divide-y">
              {results.map((r) => (
                <button
                  key={`${r.kind}-${r.id}`}
                  type="button"
                  onClick={() => add(r)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left"
                >
                  <span className="truncate">
                    {r.name}
                    <span className="text-xs text-muted-foreground">
                      {" · "}
                      {r.kind === "product"
                        ? "Produto"
                        : r.kind === "service"
                          ? "Serviço"
                          : "Plano/Pacote"}
                    </span>
                  </span>
                  <span className="font-medium shrink-0">{money(r.cents)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="rounded-md border divide-y">
            {items.map((i, idx) => (
              <div key={idx} className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{i.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {i.kind === "product"
                        ? "Produto"
                        : i.kind === "service"
                          ? "Serviço"
                          : "Plano/Pacote"}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setItems(items.filter((_, k) => k !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Qtd</Label>
                    <Input
                      type="number"
                      min={1}
                      step={i.kind === "product" ? "0.001" : "1"}
                      value={i.quantity}
                      onChange={(e) => {
                        const next = [...items];
                        const parsed = parseFloat(e.target.value || "0");
                        next[idx] = {
                          ...i,
                          quantity: i.kind === "product" ? parsed : Math.floor(parsed),
                        };
                        setItems(next);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unit. (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={(i.unit_price_cents / 100).toFixed(2)}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...i, unit_price_cents: toCents(e.target.value) };
                        setItems(next);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Desc. (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={(i.discount_cents / 100).toFixed(2)}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...i, discount_cents: toCents(e.target.value) };
                        setItems(next);
                      }}
                    />
                  </div>
                </div>
                {creditPreview[idx] > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {creditPreview[idx]}{" "}
                    {creditPreview[idx] === 1 ? "sessão coberta" : "sessões cobertas"} pelo pacote
                  </div>
                )}
                <p className="text-xs text-right text-muted-foreground">
                  Total:{" "}
                  {money(
                    Math.max(
                      0,
                      Math.round((i.quantity - creditPreview[idx]) * i.unit_price_cents) -
                        i.discount_cents,
                    ),
                  )}
                </p>
              </div>
            ))}
          </div>
        )}

        {hasServiceOutsideAppointment && (
          <p className="text-xs text-rose-600">
            Remova os serviços que não pertencem ao agendamento selecionado.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Desconto (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value || "0"))}
            />
          </div>
          <div>
            <Label>Acréscimo (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={surcharge}
              onChange={(e) => setSurcharge(parseFloat(e.target.value || "0"))}
            />
          </div>
        </div>

        <div className="rounded-md bg-muted p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          {packageCreditCents > 0 && (
            <div className="flex justify-between font-medium text-emerald-700">
              <span>Créditos de pacote</span>
              <span>− {money(packageCreditCents)}</span>
            </div>
          )}
          {itemDiscountCents + toCents(discount) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Outros descontos</span>
              <span>− {money(itemDiscountCents + toCents(discount))}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
          {total === 0 && packageCreditCents > 0 && (
            <p className="pt-1 text-xs text-emerald-700">
              Venda coberta pelo pacote: nenhuma forma de pagamento é necessária.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Formas de pagamento</Label>
            <Button size="sm" variant="outline" onClick={addPayment} disabled={remaining <= 0}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          {payments.map((p, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
              <div>
                <Select
                  value={p.payment_option_id ?? "cash"}
                  onValueChange={(v) => {
                    const opt = options.find((o) => o.id === v);
                    const next = [...payments];
                    next[idx] = {
                      ...p,
                      payment_option_id: opt?.id ?? null,
                      method_name: opt?.name ?? "Dinheiro",
                    };
                    setPayments(next);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Forma" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.length ? (
                      options.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="cash">Dinheiro</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Input
                className="w-28"
                type="number"
                step="0.01"
                value={(p.amount_cents / 100).toFixed(2)}
                onChange={(e) => {
                  const next = [...payments];
                  next[idx] = { ...p, amount_cents: toCents(e.target.value) };
                  setPayments(next);
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setPayments(payments.filter((_, k) => k !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {payments.length > 0 && remaining !== 0 && (
            <p className={`text-xs ${remaining > 0 ? "text-amber-600" : "text-rose-600"}`}>
              {remaining > 0 ? `Falta ${money(remaining)}` : `Excedente de ${money(-remaining)}`}
            </p>
          )}
        </div>

        <div>
          <Label>Observações</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={
            loading ||
            !items.length ||
            items.some((item) => item.quantity <= 0) ||
            (items.some((item) => item.kind === "package") && !customer) ||
            hasServiceOutsideAppointment ||
            paid !== total
          }
          onClick={() =>
            onSave({
              items,
              payments,
              customer_id: customer || null,
              discount_cents: toCents(discount),
              surcharge_cents: toCents(surcharge),
              notes,
              appointment_id: appointment || null,
            })
          }
        >
          Finalizar venda
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
