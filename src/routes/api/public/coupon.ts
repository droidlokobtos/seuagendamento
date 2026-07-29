import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Validação de cupom para a página pública de agendamento.
 *
 * A função validate_coupon deixou de ser executável pela API (visitantes não
 * podem mais chamar funções internas do banco), então a validação passa por
 * este endpoint, que roda no servidor com credenciais controladas.
 */
const schema = z.object({
  company_id: z.string().uuid(),
  code: z.string().trim().min(1).max(40),
  subtotal_cents: z.number().int().min(0).max(100_000_000),
});

export const Route = createFileRoute("/api/public/coupon")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
        const { company_id, code, subtotal_cents } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("validate_coupon", {
          _company: company_id,
          _code: code,
          _subtotal_cents: subtotal_cents,
        });
        if (error) return Response.json({ error: "Não foi possível validar o cupom" }, { status: 500 });

        const row = Array.isArray(data) ? data[0] : data;
        if (!row || row.message !== "ok") {
          return Response.json({ ok: false, message: row?.message ?? "Cupom inválido" });
        }
        return Response.json({
          ok: true,
          code: row.code,
          discount_cents: row.discount_cents,
          message: row.message,
        });
      },
    },
  },
});
