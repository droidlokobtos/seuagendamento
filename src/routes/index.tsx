import { createFileRoute, Link } from "@tanstack/react-router";
import { Scissors, Sparkles, CalendarCheck, Users, BarChart3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/60 backdrop-blur bg-background/70 sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">BeautySaaS</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">Começar agora</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-secondary/40 via-background to-background" />
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Sistema white label multi-tenant
          </div>
          <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight leading-tight">
            Sua marca. Sua agenda.
            <br />
            <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              Zero complicação.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Agendamento profissional para barbearias, salões, manicures e designers de sobrancelhas.
            Sistema completo com a identidade visual da sua empresa.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg">Acessar plataforma</Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            R$ 49,90/mês — todos os recursos liberados.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: CalendarCheck, title: "Agenda inteligente", desc: "Dia, semana e mês. Confirme, remarque, cancele em segundos." },
            { icon: Users, title: "Clientes e funcionários", desc: "Histórico completo, comissões e agenda individual por profissional." },
            { icon: Sparkles, title: "White label total", desc: "Cada empresa com sua logo, cores e domínio próprio." },
            { icon: BarChart3, title: "Financeiro e relatórios", desc: "Fluxo de caixa, comissões e exportação em PDF/Excel." },
            { icon: ShieldCheck, title: "Dados isolados", desc: "Cada empresa vê apenas seus dados. Segurança em primeiro lugar." },
            { icon: Scissors, title: "Nichos prontos", desc: "Barbearia, salão, manicure, sobrancelhas — configurados por padrão." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition hover:shadow-md hover:border-accent/40">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground flex flex-wrap justify-between gap-2">
          <p>© {new Date().getFullYear()} BeautySaaS</p>
          <p>Plataforma white label para o segmento de beleza</p>
        </div>
      </footer>
    </div>
  );
}
