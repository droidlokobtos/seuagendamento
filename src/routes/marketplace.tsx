import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, Sparkles, Store } from "lucide-react";

export const Route = createFileRoute("/marketplace")({
  component: Marketplace,
  head: () => ({
    meta: [
      { title: "Marketplace de Beleza — Encontre barbearias, salões e designers próximos" },
      { name: "description", content: "Descubra e agende com barbearias, salões de beleza, manicures e designers da sua região." },
      { property: "og:title", content: "Marketplace de Beleza" },
      { property: "og:description", content: "Encontre barbearias, salões e designers próximos a você." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Marketplace() {
  const [q, setQ] = useState("");
  const [niche, setNiche] = useState<string>("all");

  const { data: niches = [] } = useQuery({
    queryKey: ["mp-niches"],
    queryFn: async () => (await supabase.from("niches").select("id, name").order("name")).data ?? [],
  });

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["marketplace"],
    queryFn: async () =>
      (await supabase
        .from("companies")
        .select("id, name, slug, logo_url, primary_color, short_description, city, state, niche_id, niches(name)")
        .eq("listed_in_marketplace", true)
        .neq("status", "suspended")
        .order("name")).data ?? [],
  });

  const filtered = companies.filter((c: any) => {
    const matchQ = !q ||
      c.name?.toLowerCase().includes(q.toLowerCase()) ||
      c.city?.toLowerCase().includes(q.toLowerCase()) ||
      c.short_description?.toLowerCase().includes(q.toLowerCase());
    const matchN = niche === "all" || c.niche_id === niche;
    return matchQ && matchN;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/40">
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-16 text-center">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Store className="h-3.5 w-3.5" /> Marketplace
          </div>
          <h1 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
            Encontre profissionais de beleza próximos
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Barbearias, salões, manicures e designers com agenda online.
          </p>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, cidade…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={niche} onValueChange={setNiche}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {niches.map((n: any) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-16">Carregando…</p>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhum estabelecimento encontrado.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c: any) => (
              <Link key={c.id} to="/b/$slug" params={{ slug: c.slug }} className="group">
                <Card className="overflow-hidden h-full transition-all hover:shadow-md hover:-translate-y-0.5">
                  <div
                    className="h-24"
                    style={{ background: c.primary_color || "hsl(var(--primary))" }}
                  />
                  <CardContent className="p-4 -mt-8">
                    <div className="flex items-center gap-3">
                      {c.logo_url ? (
                        <img src={c.logo_url} className="h-14 w-14 rounded-xl border-4 border-background object-cover" alt="" />
                      ) : (
                        <div className="h-14 w-14 rounded-xl border-4 border-background bg-muted grid place-items-center">
                          <Sparkles className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="mt-2 font-semibold group-hover:text-primary transition-colors">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.niches?.name ?? "—"}</p>
                    {c.short_description && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{c.short_description}</p>
                    )}
                    {(c.city || c.state) && (
                      <p className="mt-2 text-xs text-muted-foreground inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {[c.city, c.state].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
