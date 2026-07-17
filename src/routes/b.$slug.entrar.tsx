import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/b/$slug/entrar")({
  loader: async ({ params }) => {
    const { data: company } = await supabase
      .from("companies")
      .select("id,name,slug,logo_url,primary_color,secondary_color,status")
      .eq("slug", params.slug)
      .maybeSingle();
    if (!company || company.status === "suspended") throw notFound();
    return { company };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Entrar — ${loaderData.company.name}` : "Entrar" },
      { name: "robots", content: "noindex" },
    ],
  }),
  notFoundComponent: () => <div className="p-8 text-center">Página indisponível.</div>,
  component: EntrarPage,
});

function EntrarPage() {
  const { company } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/b/$slug/minha-conta", params: { slug } });
    });
  }, [navigate, slug]);

  const primary = company.primary_color || "#0f172a";
  const accent = company.secondary_color || "#c9a86a";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}/b/${slug}/minha-conta`,
            data: { full_name: form.name, phone: form.phone },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Confirme o cadastro pelo e-mail para continuar.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (error) throw error;
      }
      toast.success(mode === "signup" ? "Conta criada!" : "Bem-vindo(a)!");
      navigate({ to: "/b/$slug/minha-conta", params: { slug } });
    } catch (err: any) {
      toast.error(err.message ?? "Erro na autenticação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }} className="text-white">
        <div className="max-w-md mx-auto p-6 flex items-center gap-3">
          <Link to="/b/$slug" params={{ slug }} className="text-white/80 hover:text-white">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          {company.logo_url ? (
            <img src={company.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover ring-2 ring-white/40" />
          ) : (
            <div className="h-10 w-10 rounded-xl grid place-items-center bg-white/15 ring-2 ring-white/40">
              <Sparkles className="h-5 w-5" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold leading-none">{company.name}</h1>
            <p className="text-xs text-white/80 mt-1">Área do cliente</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 md:p-6">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-md py-1.5 ${mode === "login" ? "bg-background shadow-sm font-semibold" : "text-muted-foreground"}`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-md py-1.5 ${mode === "signup" ? "bg-background shadow-sm font-semibold" : "text-muted-foreground"}`}
              >
                Cadastrar
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <>
                  <div>
                    <Label>Nome</Label>
                    <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>WhatsApp</Label>
                    <Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
                  </div>
                </>
              )}
              <div>
                <Label>E-mail</Label>
                <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" size="lg" style={{ background: primary }} disabled={loading}>
                {loading ? "..." : mode === "signup" ? "Criar conta" : "Entrar"}
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground">
              Ao continuar você concorda em receber lembretes por e-mail sobre seus agendamentos.
            </p>
          </CardContent>
        </Card>

        <div className="text-center mt-4">
          <Link to="/b/$slug" params={{ slug }} className="text-sm text-muted-foreground hover:underline">
            Voltar para agendamento
          </Link>
        </div>
      </div>
    </div>
  );
}
