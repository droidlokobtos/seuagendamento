import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import {
  useCustomerTimeline,
  TIMELINE_FILTERS,
  eventAmountLabel,
  dayLabel,
  type TimelineEvent,
} from "@/lib/customer-timeline";

const TONE: Record<string, string> = {
  default: "border-border bg-card",
  success: "border-emerald-500/30 bg-emerald-500/5",
  danger: "border-destructive/30 bg-destructive/5",
  warning: "border-amber-500/30 bg-amber-500/5",
};

export function CustomerTimeline({
  customerId,
  customer,
}: {
  customerId: string;
  customer: { name: string; created_at: string };
}) {
  const { data: events = [], isLoading } = useCustomerTimeline(customerId, customer);
  const [filter, setFilter] = useState<string>("todos");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return events.filter((e) => {
      if (filter !== "todos") {
        if (filter === "financeiro") {
          if (!["financeiro", "pagamentos"].includes(e.category)) return false;
        } else if (e.category !== filter) return false;
      }
      if (!term) return true;
      return [e.title, e.description, e.detail, e.actor].filter(Boolean).join(" ").toLowerCase().includes(term);
    });
  }, [events, filter, q]);

  const groups = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const e of filtered) {
      const key = dayLabel(e.at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pesquisar na linha do tempo (ex.: pagamento, alergia…)"
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TIMELINE_FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            className="h-7 rounded-full px-3 text-xs"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando histórico…</p>}
      {!isLoading && !filtered.length && (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum evento encontrado.</p>
      )}

      <div className="space-y-6">
        {groups.map(([day, list]) => (
          <div key={day}>
            <div className="mb-3 flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day}</p>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="relative space-y-3 pl-8">
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
              {list.map((e) => {
                const amount = eventAmountLabel(e.amountCents);
                return (
                  <div key={e.id} className="relative">
                    <div className="absolute -left-8 top-1 flex h-8 w-8 items-center justify-center rounded-full border bg-background text-sm shadow-sm">
                      {e.icon}
                    </div>
                    <div className={`rounded-lg border p-3 ${TONE[e.tone ?? "default"]}`}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium leading-tight">{e.title}</p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {new Date(e.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {e.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
                      )}
                      {e.detail && (
                        <p className="mt-1 rounded bg-muted/50 p-2 text-[11px] text-muted-foreground">{e.detail}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {amount && (
                          <Badge variant="secondary" className="text-[10px]">
                            {amount}
                          </Badge>
                        )}
                        {e.actor && <span className="text-[10px] text-muted-foreground">por {e.actor}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
