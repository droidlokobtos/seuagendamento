import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { waLink } from "@/lib/format";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Megaphone, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/campaigns")({ component: Campaigns });

type Campaign = {
  id: string; title: string; message: string;
  audience: "all" | "birthdays" | "inactive_30d" | "vip";
  channel: "whatsapp" | "email" | "sms";
  status: "draft" | "scheduled" | "sent" | "archived";
  scheduled_for: string | null; sent_at: string | null; recipients_count: number;
};

const AUDIENCE_LABEL: Record<string, string> = {
  all: "Todos os clientes", birthdays: "Aniversariantes do mês",
  inactive_30d: "Inativos 30+ dias", vip: "VIP (10+ agendamentos)",
};

function Campaigns() {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();
  const [open, setOpen] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["campaigns", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("*")
        .eq("company_id", activeCompany!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const create = useMutation({
    mutationFn: async (p: Partial<Campaign>) => {
      const { error } = await supabase.from("campaigns").insert({ ...p, company_id: activeCompany!.id } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); setOpen(false); toast.success("Campanha criada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("campaigns").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campanhas</h1>
          <p className="text-sm text-muted-foreground">Envie mensagens para grupos de clientes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nova campanha</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova campanha</DialogTitle></DialogHeader>
            <CampaignForm onSubmit={(p) => create.mutate(p)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {items.map((c) => <CampaignCard key={c.id} c={c} onDelete={() => del.mutate(c.id)} />)}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma campanha ainda.</p>}
      </div>
    </div>
  );
}

function CampaignCard({ c, onDelete }: { c: Campaign; onDelete: () => void }) {
  const qc = useQueryClient();
  const { activeCompany } = useCompany();

  const send = useMutation({
    mutationFn: async () => {
      // Fetch matching customer phones for WhatsApp export
      const q = supabase.from("customers").select("id,name,phone").eq("company_id", activeCompany!.id).not("phone", "is", null);
      let ids: string[] = [];
      if (c.audience === "birthdays") {
        const { data } = await supabase.from("customer_birthdays_this_month").select("id").eq("company_id", activeCompany!.id);
        ids = (data ?? []).map((x: any) => x.id);
      }
      const { data: custs, error } = c.audience === "birthdays"
        ? await q.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
        : await q;
      if (error) throw error;
      const list = (custs ?? []) as Array<{ id: string; name: string; phone: string }>;

      // Open WhatsApp for each recipient (batch of first — user opens sequentially)
      list.slice(0, 20).forEach((cust) => {
        const msg = c.message.replaceAll("{{nome}}", cust.name);
        window.open(waLink(cust.phone, msg), "_blank");
      });

      await supabase.from("campaigns").update({ status: "sent", sent_at: new Date().toISOString(), recipients_count: list.length }).eq("id", c.id);
      return list.length;
    },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ["campaigns"] }); toast.success(`Enviado para ${n} destinatários (primeiros 20 abertos)`); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /><span className="font-medium">{c.title}</span><Badge variant="secondary">{c.status}</Badge></div>
          <div className="flex gap-2">
            {c.status !== "sent" && <Button size="sm" onClick={() => send.mutate()}><Send className="mr-2 h-4 w-4" />Enviar</Button>}
            <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        <p className="text-sm">{c.message}</p>
        <div className="text-xs text-muted-foreground">{AUDIENCE_LABEL[c.audience]} · {c.channel} {c.sent_at && `· enviada em ${new Date(c.sent_at).toLocaleString("pt-BR")} · ${c.recipients_count} destinatários`}</div>
      </CardContent>
    </Card>
  );
}

function CampaignForm({ onSubmit }: { onSubmit: (p: Partial<Campaign>) => void }) {
  const [f, setF] = useState({
    title: "", message: "Olá {{nome}}! ", audience: "all" as const, channel: "whatsapp" as const, status: "draft" as const,
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
      <div><Label>Título</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div>
        <Label>Mensagem</Label>
        <Textarea required rows={4} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
        <p className="text-xs text-muted-foreground mt-1">Use <code>{"{{nome}}"}</code> para personalizar.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Público</Label>
          <Select value={f.audience} onValueChange={(v) => setF({ ...f, audience: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="birthdays">Aniversariantes do mês</SelectItem>
              <SelectItem value="inactive_30d">Inativos 30+ dias</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Canal</Label>
          <Select value={f.channel} onValueChange={(v) => setF({ ...f, channel: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter><Button type="submit">Criar</Button></DialogFooter>
    </form>
  );
}
