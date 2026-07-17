import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateBR } from "@/lib/format";

export const Route = createFileRoute("/admin/logs")({ component: LogsPage });

const eventColor: Record<string, string> = {
  login: "bg-green-500/15 text-green-700",
  logout: "bg-muted",
  password_changed: "bg-blue-500/15 text-blue-700",
  password_reset_requested: "bg-amber-500/15 text-amber-700",
};

function LogsPage() {
  const { data = [] } = useQuery({
    queryKey: ["admin_logs"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_access_logs")
        .select("*").order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Logs de acesso</h1>
          <p className="text-sm text-muted-foreground">Auditoria de login, logout e alterações de senha (últimos 200).</p>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Eventos recentes</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>User-Agent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{dateBR(l.created_at)} {new Date(l.created_at).toLocaleTimeString("pt-BR")}</TableCell>
                    <TableCell className="text-xs">{l.email ?? l.user_id?.slice(0, 8)}</TableCell>
                    <TableCell><Badge className={eventColor[l.event] ?? ""} variant="secondary">{l.event}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[280px]">{l.user_agent}</TableCell>
                  </TableRow>
                ))}
                {!data.length && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Sem registros ainda.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
