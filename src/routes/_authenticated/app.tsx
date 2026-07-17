import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Calendar, LogOut, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app")({
  component: CompanyApp,
});

function CompanyApp() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b border-border/60 flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-semibold">BeautySaaS</span>
        </div>
        <Button variant="ghost" size="sm" onClick={async () => { await signOut(); void navigate({ to: "/auth", replace: true }); }}>
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </header>
      <main className="max-w-4xl mx-auto p-6 md:p-10">
        <div className="text-center py-12">
          <div className="grid h-16 w-16 mx-auto place-items-center rounded-2xl bg-primary/10 text-primary">
            <Calendar className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Painel da empresa</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Olá {user?.user_metadata?.full_name ?? user?.email}! Seu painel operacional (agenda, clientes, financeiro)
            será liberado na próxima fase do desenvolvimento.
          </p>
        </div>

        <Card className="mt-6">
          <CardContent className="p-6">
            <p className="text-sm font-medium">Fase 2 — em breve</p>
            <ul className="mt-3 text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>Agenda diária/semanal/mensal</li>
              <li>Cadastro de clientes e histórico</li>
              <li>Funcionários, serviços e comissões</li>
              <li>Financeiro, estoque e relatórios</li>
              <li>Página pública de agendamento (/empresa)</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
