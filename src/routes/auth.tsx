import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/home" as any, replace: true });
  }, [session, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!acceptedTerms) {
          throw new Error("Você precisa aceitar os Termos de Uso e Contratação para criar sua conta.");
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, terms_accepted_at: new Date().toISOString() },
          },
        });
        if (error) throw error;
        toast.success("Conta criada!", { description: "Você já pode entrar." });
      } else {
        const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (signIn.user) {
          void supabase.from("admin_access_logs").insert({
            user_id: signIn.user.id, email: signIn.user.email, event: "login",
            user_agent: navigator.userAgent,
          } as any);
        }
        toast.success("Bem-vindo!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na autenticação");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Erro Google");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      {/* Left: brand panel */}
      <div className="hidden md:flex relative bg-primary text-primary-foreground p-10 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,theme(colors.accent/25),transparent_60%)]" />
        <div className="relative z-10 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">BeautySaaS</span>
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold leading-tight">
            Sua marca em cada agendamento.
          </h1>
          <p className="mt-3 text-primary-foreground/70 max-w-sm">
            Plataforma white label para profissionais de beleza. Uma única gestão, várias empresas.
          </p>
        </div>
        <div className="relative z-10 text-xs text-primary-foreground/50">
          © {new Date().getFullYear()} BeautySaaS
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-6 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">BeautySaaS</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Acesse sua conta para continuar"
              : "Comece a usar em poucos segundos"}
          </p>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")} className="mt-6">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value={mode} className="mt-4">
              <form onSubmit={submit} className="space-y-3">
                {mode === "signup" && (
                  <div>
                    <Label htmlFor="fullName">Nome completo</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                )}
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
                {mode === "signup" && (
                  <label className="flex items-start gap-2 text-xs text-muted-foreground leading-snug">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                    />
                    <span>
                      Li e aceito os{" "}
                      <Link to="/termos" target="_blank" className="text-primary underline hover:no-underline">
                        Termos de Uso e Contratação
                      </Link>{" "}
                      da plataforma.
                    </span>
                  </label>
                )}
                <Button type="submit" disabled={busy || (mode === "signup" && !acceptedTerms)} className="w-full">
                  {busy ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
                </Button>
              </form>

              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
              </div>

              <Button variant="outline" type="button" onClick={google} disabled={busy} className="w-full">
                <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.68l-3.57-2.75c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.28-1.93-6.14-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.86 14.1A6.98 6.98 0 0 1 5.5 12c0-.73.13-1.43.36-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.44 1.18 4.94l3.68-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.68 2.84C6.72 7.31 9.14 5.38 12 5.38z"/>
                </svg>
                Entrar com Google
              </Button>
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">← Voltar ao site</Link>
            <button
              type="button"
              className="hover:underline text-primary"
              onClick={async () => {
                if (!email) return toast.error("Informe seu e-mail primeiro");
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) return toast.error(error.message);
                void supabase.from("admin_access_logs").insert({
                  email, event: "password_reset_requested", user_agent: navigator.userAgent,
                } as any);
                toast.success("Enviamos um link para redefinir sua senha.");
              }}
            >Esqueci minha senha</button>
          </div>
        </div>
      </div>
    </div>
  );
}
// touch
