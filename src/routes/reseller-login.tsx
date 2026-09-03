import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Handshake, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/reseller-login")({
  component: ResellerLogin,
  head: () => ({
    meta: [
      { title: "Acesso do revendedor | BeautySaaS" },
      {
        name: "description",
        content: "Acesso exclusivo ao painel de vendas, comissões e repasses do revendedor.",
      },
    ],
  }),
});

function ResellerLogin() {
  const navigate = useNavigate();
  const { session, loading, isReseller } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !session) return;
    if (isReseller) void navigate({ to: "/reseller", replace: true });
    else void navigate({ to: "/home", replace: true });
  }, [isReseller, loading, navigate, session]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;

      if (data.user) {
        void supabase.from("admin_access_logs").insert({
          user_id: data.user.id,
          email: data.user.email,
          event: "reseller_login",
          user_agent: navigator.userAgent,
        } as any);
      }
      toast.success("Acesso realizado com sucesso.");
      void navigate({ to: "/home", replace: true });
    } catch {
      toast.error("E-mail ou senha inválidos.");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Informe seu e-mail primeiro.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("Não foi possível enviar a recuperação de senha.");
      return;
    }
    toast.success("Enviamos um link para redefinir sua senha.");
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,hsl(var(--accent)/0.2),transparent_42%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/0.14),transparent_45%)]" />
      <section className="w-full max-w-md rounded-3xl border border-border/70 bg-card/95 p-6 shadow-2xl shadow-primary/10 backdrop-blur sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Handshake className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
              Área comercial
            </p>
            <h1 className="text-xl font-semibold">Portal do Revendedor</h1>
          </div>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          Entre para acompanhar empresas vendidas, comissões liberadas e datas de repasse.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reseller-email">E-mail</Label>
            <Input
              id="reseller-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reseller-password">Senha</Label>
            <Input
              id="reseller-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button className="h-11 w-full" type="submit" disabled={busy}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            {busy ? "Entrando..." : "Acessar meu painel"}
          </Button>
        </form>

        <div className="mt-5 flex items-center justify-between gap-3 text-xs">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao site
          </Link>
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={resetPassword}
          >
            Esqueci minha senha
          </button>
        </div>

        <p className="mt-6 border-t pt-5 text-center text-xs text-muted-foreground">
          O acesso é criado exclusivamente pelo Admin Master.
        </p>
      </section>
    </main>
  );
}
