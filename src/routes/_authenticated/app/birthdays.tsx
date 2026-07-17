import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cake, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/birthdays")({ component: Birthdays });

type B = { id: string; name: string; phone: string | null; email: string | null; birthdate: string; day: number };

function Birthdays() {
  const { activeCompany } = useCompany();
  const { data = [] } = useQuery({
    queryKey: ["birthdays", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_birthdays_this_month").select("*")
        .eq("company_id", activeCompany!.id).order("day");
      if (error) throw error;
      return data as B[];
    },
  });

  const monthName = new Date().toLocaleDateString("pt-BR", { month: "long" });

  const send = (b: B) => {
    if (!b.phone) return;
    const msg = encodeURIComponent(`Olá ${b.name}! 🎂 Parabéns pelo seu aniversário! ${activeCompany?.name} deseja um dia incrível — passe aqui e ganhe um mimo especial 🎁`);
    window.open(`https://wa.me/${b.phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Cake className="h-6 w-6 text-primary" />Aniversariantes de {monthName}</h1>
        <p className="text-sm text-muted-foreground">Envie uma mensagem carinhosa e traga o cliente de volta.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-4 flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">{b.name}</div>
                <div className="text-sm text-muted-foreground">Dia {String(b.day).padStart(2, "0")} · {b.phone ?? "sem telefone"}</div>
              </div>
              {b.phone && <Button size="sm" onClick={() => send(b)}><MessageCircle className="mr-2 h-4 w-4" />Parabenizar</Button>}
            </CardContent>
          </Card>
        ))}
        {data.length === 0 && <p className="text-sm text-muted-foreground">Nenhum aniversariante este mês.</p>}
      </div>
    </div>
  );
}
