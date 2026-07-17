import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/no-access")({
  component: NoAccess,
});

function NoAccess() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">Sem acesso ainda</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A conta <strong>{user?.email}</strong> ainda não está vinculada a nenhuma empresa.
          Entre em contato com o administrador da plataforma para receber acesso.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={async () => { await signOut(); void navigate({ to: "/auth", replace: true }); }}>
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
