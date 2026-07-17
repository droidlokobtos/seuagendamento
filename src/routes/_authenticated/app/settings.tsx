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
    name: "", slug: "", phone: "", whatsapp: "", email: "", address: "",
    logo_url: "", banner_url: "", primary_color: "#3b2a1f", secondary_color: "#c9a961",
    app_icon_url: "", custom_domain: "", short_description: "", description: "",
    welcome_message: "", city: "", state: "",
    instagram_url: "", facebook_url: "", tiktok_url: "", website_url: "",
    listed_in_marketplace: false, show_staff_on_portal: true, show_reviews_on_portal: true,
  });

  const { data: company } = useQuery({
    queryKey: ["company-full", companyId],
    queryFn: async () => (await supabase.from("companies").select("*").eq("id", companyId).single()).data,
  });

  useEffect(() => {
    if (company) {
      const c: any = company;
      setForm({
        name: c.name ?? "", slug: c.slug ?? "", phone: c.phone ?? "", whatsapp: c.whatsapp ?? "",
        email: c.email ?? "", address: c.address ?? "",
        logo_url: c.logo_url ?? "", banner_url: c.banner_url ?? "",
        primary_color: c.primary_color ?? "#3b2a1f", secondary_color: c.secondary_color ?? "#c9a961",
        app_icon_url: c.app_icon_url ?? "", custom_domain: c.custom_domain ?? "",
        short_description: c.short_description ?? "", description: c.description ?? "",
        welcome_message: c.welcome_message ?? "", city: c.city ?? "", state: c.state ?? "",
        instagram_url: c.instagram_url ?? "", facebook_url: c.facebook_url ?? "",
        tiktok_url: c.tiktok_url ?? "", website_url: c.website_url ?? "",
        listed_in_marketplace: !!c.listed_in_marketplace,
        show_staff_on_portal: c.show_staff_on_portal !== false,
        show_reviews_on_portal: c.show_reviews_on_portal !== false,
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
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-semibold">Dados da empresa</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Nome fantasia</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Slug público</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} /></div>
            <div><Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>WhatsApp (atendimento)</Label>
              <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="55 11 99999-9999" /></div>
            <div className="md:col-span-2"><Label>E-mail</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Endereço completo</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro, cidade/UF" /></div>
            <div className="md:col-span-2"><Label>Descrição da empresa</Label>
              <textarea className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Fale sobre sua empresa, diferenciais e serviços." /></div>
          </div>
          <div className="pt-2">
            <Button onClick={() => saveCompany.mutate()} disabled={saveCompany.isPending}>Salvar dados</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-semibold">Identidade visual</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><Label>Logotipo (URL)</Label>
              <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://…/logo.png" />
              {form.logo_url && <img src={form.logo_url} alt="logo" className="mt-2 h-16 w-16 rounded object-cover border" />}
            </div>
            <div className="md:col-span-2"><Label>Imagem de capa (URL)</Label>
              <Input value={form.banner_url} onChange={(e) => setForm({ ...form, banner_url: e.target.value })} placeholder="https://…/capa.jpg" />
              {form.banner_url && <img src={form.banner_url} alt="capa" className="mt-2 h-24 w-full rounded object-cover border" />}
            </div>
            <div><Label>Cor primária</Label>
              <Input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} /></div>
            <div><Label>Cor secundária</Label>
              <Input type="color" value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} /></div>
          </div>
          <div className="pt-2">
            <Button onClick={() => saveCompany.mutate()} disabled={saveCompany.isPending}>Salvar identidade</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-semibold">Portal público de agendamento</h2>
          <p className="text-xs text-muted-foreground">Configurações que aparecem na sua página pública.</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><Label>Mensagem de boas-vindas</Label>
              <Input value={form.welcome_message} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })} placeholder="Bem-vindo! Agende seu horário em poucos cliques." /></div>
            <div><Label>Instagram (URL)</Label>
              <Input value={form.instagram_url} onChange={(e) => setForm({ ...form, instagram_url: e.target.value })} placeholder="https://instagram.com/sua-empresa" /></div>
            <div><Label>Facebook (URL)</Label>
              <Input value={form.facebook_url} onChange={(e) => setForm({ ...form, facebook_url: e.target.value })} /></div>
            <div><Label>TikTok (URL)</Label>
              <Input value={form.tiktok_url} onChange={(e) => setForm({ ...form, tiktok_url: e.target.value })} /></div>
            <div><Label>Site (URL)</Label>
              <Input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} /></div>
            <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Mostrar profissionais no portal</p>
                <p className="text-xs text-muted-foreground">Exibe a lista da sua equipe na página pública.</p>
              </div>
              <Switch checked={form.show_staff_on_portal} onCheckedChange={(v) => setForm({ ...form, show_staff_on_portal: v })} />
            </div>
            <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Mostrar avaliações no portal</p>
                <p className="text-xs text-muted-foreground">Exibe depoimentos publicados dos clientes.</p>
              </div>
              <Switch checked={form.show_reviews_on_portal} onCheckedChange={(v) => setForm({ ...form, show_reviews_on_portal: v })} />
            </div>
          </div>
          <div className="pt-2">
            <Button onClick={() => saveCompany.mutate()} disabled={saveCompany.isPending}>Salvar portal</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="font-semibold">White label & Marketplace</h2>
            <p className="text-xs text-muted-foreground">Publique sua marca com identidade e domínio próprios, e apareça no marketplace público.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><Label>Descrição curta (marketplace)</Label>
              <Input value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} placeholder="Ex.: Barbearia premium no centro" /></div>
            <div><Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>Estado (UF)</Label>
              <Input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} /></div>
            <div className="md:col-span-2"><Label>URL do ícone do app (PWA)</Label>
              <Input value={form.app_icon_url} onChange={(e) => setForm({ ...form, app_icon_url: e.target.value })} placeholder="https://…/icon-512.png" /></div>
            <div className="md:col-span-2"><Label>Domínio próprio</Label>
              <Input value={form.custom_domain} onChange={(e) => setForm({ ...form, custom_domain: e.target.value.toLowerCase() })} placeholder="agenda.minhamarca.com.br" />
              <p className="text-xs text-muted-foreground mt-1">Aponte um CNAME do seu domínio para o endereço da plataforma. Configuração de DNS/SSL feita pelo suporte.</p></div>
            <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Aparecer no marketplace público</p>
                <p className="text-xs text-muted-foreground">/marketplace lista sua empresa para novos clientes.</p>
              </div>
              <Switch checked={form.listed_in_marketplace} onCheckedChange={(v) => setForm({ ...form, listed_in_marketplace: v })} />
            </div>
          </div>
          <div className="pt-2">
            <Button onClick={() => saveCompany.mutate()} disabled={saveCompany.isPending}>Salvar white label</Button>
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
