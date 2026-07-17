import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Link } from "@tanstack/react-router";

export function NotificationsBell() {
  const { activeCompany } = useCompany();
  const qc = useQueryClient();
  const companyId = activeCompany?.id;

  const { data = [] } = useQuery({
    queryKey: ["notifications", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("notifications")
        .select("*").eq("company_id", companyId)
        .order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
    enabled: !!companyId,
    refetchInterval: 30_000,
  });

  const unread = data.filter((n: any) => !n.read_at).length;

  const markAll = async () => {
    if (!companyId) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("company_id", companyId).is("read_at", null);
    qc.invalidateQueries({ queryKey: ["notifications", companyId] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <p className="text-sm font-semibold">Notificações</p>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={markAll} className="h-7 text-xs">
              <Check className="h-3 w-3 mr-1" /> Marcar lidas
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {!data.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem notificações.</p>
          ) : (
            data.map((n: any) => {
              const waUrl = n.metadata?.wa_url as string | undefined;
              return (
                <div
                  key={n.id}
                  className={`block px-3 py-2 border-b hover:bg-muted/50 ${!n.read_at ? "bg-primary/5" : ""}`}
                >
                  <Link to={n.link ?? "/app"} className="block">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(n.created_at).toLocaleString("pt-BR")}
                    </p>
                  </Link>
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
                    >
                      Enviar no WhatsApp →
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
