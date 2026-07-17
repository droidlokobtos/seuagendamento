import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/change-password")({
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { user, mustChangePassword, refresh, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("A senha precisa ter no mínimo 8 caracteres");
    if (pwd !== pwd2) return toast.error("As senhas não coincidem");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", user!.id);
      await supabase.from("admin_access_logs").insert({
        user_id: user!.id, email: user!.email, event: "password_changed",
        user_agent: navigator.userAgent,
      } as any);
      await refresh();
      toast.success("Senha atualizada!");
      void navigate({ to: isSuperAdmin ? "/admin" : "/app", replace: true });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
            {mustChangePassword ? <ShieldCheck className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
          </div>
          <CardTitle>{mustChangePassword ? "Defina uma nova senha" : "Alterar senha"}</CardTitle>
          {mustChangePassword && (
            <p className="text-sm text-muted-foreground">Por segurança, você precisa criar uma nova senha antes de continuar.</p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div><Label>Nova senha</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} minLength={8} required /></div>
            <div><Label>Confirmar senha</Label><Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} minLength={8} required /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
