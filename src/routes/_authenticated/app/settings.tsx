import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { slugify } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const METHODS: { key: string; label: string }[] = [
  { key: "cash", label: "Dinheiro" },
  { key: "pix", label: "PIX" },
  { key: "credit_card", label: "Cartão de crédito" },
  { key: "debit_card", label: "Cartão de débito" },
  { key: "bank_transfer", label: "Transferência" },
  { key: "other", label: "Outro" },
];

function SettingsPage() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const companyId = activeCompany!.id;

  const [form, setForm] = useState({
    name: "", slug: "", phone: "", whatsapp: "", email: "",
    logo_url: "", primary_color: "#3b2a1f", secondary_color: "#c9a961",
  });

  const { data: company } = useQuery({
    queryKey: ["company-full", companyId],
    queryFn: async () => (await supabase.from("companies").select("*").eq("id", companyId).single()).data,
  });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? "",
        slug: company.slug ?? "",
        phone: company.phone ?? "",
        whatsapp: company.whatsapp ?? "",
        email: company.email ?? "",
        logo_url: company.logo_url ?? "",
        primary_color: company.primary_color ?? "#3b2a1f",
        secondary_color: company.secondary_color ?? "#c9a961",
      });
    }
  }, [company]);

  const saveCompany = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").update(form).eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Dados salvos"); qc.invalidateQueries({ queryKey: ["company-full", companyId] }); qc.invalidateQueries({ queryKey: ["my-companies"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: hours = [] } = useQuery({
    queryKey: ["hours", companyId],
    queryFn: async () => (await supabase.from("company_hours").select("*").eq("company_id", companyId).order("weekday")).data ?? [],
  });

  const upsertHour = useMutation({
    mutationFn: async (h: any) => {
      const { error } = await supabase.from("company_hours").upsert(
        { company_id: companyId, weekday: h.weekday, start_time: h.start_time, end_time: h.end_time, closed: h.closed },
        { onConflict: "company_id,weekday" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hours", companyId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const getHour = (wd: number) => {
    const h = (hours as any[]).find((x) => x.weekday === wd);
    return h ?? { weekday: wd, start_time: "09:00", end_time: "18:00", closed: true };
  };

  const { data: methods = [] } = useQuery({
    queryKey: ["pms", companyId],
    queryFn: async () => (await supabase.from("payment_methods").select("*").eq("company_id", companyId)).data ?? [],
  });

  const upsertMethod = useMutation({
    mutationFn: async (m: { method: string; enabled: boolean }) => {
      const { error } = await supabase.from("payment_methods").upsert(
        { company_id: companyId, method: m.method as any, enabled: m.enabled },
        { onConflict: "company_id,method" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pms", companyId] }),
  });

  const isMethodOn = (k: string) => !!(methods as any[]).find((m) => m.method === k)?.enabled;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Configurações da empresa</h1>
        <p className="text-sm text-muted-foreground">Dados públicos, identidade visual e horários.</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-semibold">Dados</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Slug público</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} /></div>
            <div><Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>E-mail</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>URL do logo</Label>
              <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} /></div>
            <div><Label>Cor primária</Label>
              <Input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} /></div>
            <div><Label>Cor secundária</Label>
              <Input type="color" value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} /></div>
          </div>
          <div className="pt-2">
            <Button onClick={() => saveCompany.mutate()} disabled={saveCompany.isPending}>Salvar dados</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="font-semibold">Horário de funcionamento</h2>
          <div className="space-y-2">
            {WEEKDAYS.map((label, i) => {
              const h = getHour(i);
              return (
                <div key={i} className="flex items-center gap-3 flex-wrap py-2 border-b border-border/40 last:border-0">
                  <div className="w-24 text-sm font-medium">{label}</div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!h.closed}
                      onCheckedChange={(open) => upsertHour.mutate({ ...h, closed: !open })}
                    />
                    <span className="text-xs text-muted-foreground w-14">{h.closed ? "Fechado" : "Aberto"}</span>
                  </div>
                  <Input type="time" className="w-28" disabled={h.closed} value={h.start_time?.slice(0, 5) ?? "09:00"}
                    onChange={(e) => upsertHour.mutate({ ...h, start_time: e.target.value })} />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input type="time" className="w-28" disabled={h.closed} value={h.end_time?.slice(0, 5) ?? "18:00"}
                    onChange={(e) => upsertHour.mutate({ ...h, end_time: e.target.value })} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="font-semibold">Formas de pagamento</h2>
          <div className="grid md:grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <div key={m.key} className="flex items-center justify-between py-2 px-3 rounded-lg border border-border/60">
                <span className="text-sm">{m.label}</span>
                <Switch checked={isMethodOn(m.key)} onCheckedChange={(v) => upsertMethod.mutate({ method: m.key, enabled: v })} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
