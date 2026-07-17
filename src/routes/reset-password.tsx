import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase places the recovery session in the URL hash on arrival.
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) setReady(true);
    else {
      supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("Mínimo 8 caracteres");
    if (pwd !== pwd2) return toast.error("As senhas não coincidem");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success("Senha redefinida! Faça login.");
      await supabase.auth.signOut();
      void navigate({ to: "/auth", replace: true });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle>Redefinir senha</CardTitle>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <p className="text-sm text-muted-foreground text-center">Link de recuperação inválido ou expirado.</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Nova senha</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} minLength={8} required /></div>
              <div><Label>Confirmar senha</Label><Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} minLength={8} required /></div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Salvando…" : "Redefinir"}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
