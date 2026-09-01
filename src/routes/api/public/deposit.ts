import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { fileSignatureMatchesMime, sameBrazilianPhone } from "@/lib/public-security";
import { guardPublicRequest, rateLimitResponse } from "@/lib/public-api-protection.server";

/**
 * Envio do comprovante do pagamento antecipado (sinal) pelo cliente.
 * O pagamento é feito externamente via PIX — aqui apenas registramos o
 * comprovante/identificador para conferência da equipe.
 */
const schema = z.object({
  appointment_id: z.string().uuid(),
  phone: z.string().trim().min(6).max(40),
  transaction_ref: z.string().trim().max(120).optional().or(z.literal("")),
  /** arquivo em base64 (data URL) — imagem ou PDF, até ~5MB */
  file_base64: z.string().max(8_000_000).optional().or(z.literal("")),
  file_name: z.string().trim().max(160).optional().or(z.literal("")),
});

export const Route = createFileRoute("/api/public/deposit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
        const { appointment_id, phone, transaction_ref, file_base64, file_name } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const guard = await guardPublicRequest(supabaseAdmin, request, {
          scope: "deposit:submit",
          limit: 6,
          windowSeconds: 900,
        });
        if (!guard.allowed) return rateLimitResponse(guard.retryAfter);

        const { data: appt } = await supabaseAdmin
          .from("appointments")
          .select(
            "id,company_id,customer_id,deposit_required_cents,total_cents,discount_cents,surcharge_cents,paid_cents",
          )
          .eq("id", appointment_id)
          .maybeSingle();
        if (!appt) return Response.json({ error: "Agendamento não encontrado" }, { status: 404 });

        // O telefone completo precisa corresponder ao cadastro do agendamento.
        const { data: cust } = await supabaseAdmin
          .from("customers")
          .select("id,phone,whatsapp")
          .eq("id", appt.customer_id ?? "")
          .maybeSingle();
        if (
          !cust ||
          (!sameBrazilianPhone(cust.whatsapp, phone) && !sameBrazilianPhone(cust.phone, phone))
        ) {
          return Response.json(
            { error: "Não foi possível validar seu agendamento" },
            { status: 403 },
          );
        }

        const amount = Number((appt as any).deposit_required_cents ?? 0);
        if (amount <= 0)
          return Response.json({ error: "Este agendamento não exige sinal" }, { status: 400 });

        // Evita comprovantes duplicados aguardando análise
        // (limit(1) porque podem existir várias tentativas pendentes)
        const { data: existingRows } = await supabaseAdmin
          .from("appointment_payments")
          .select("id")
          .eq("appointment_id", appointment_id)
          .eq("kind", "deposit")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1);
        const existing = existingRows?.[0] ?? null;

        let proofUrl: string | null = null;
        if (file_base64) {
          const match = /^data:([^;]+);base64,(.+)$/.exec(file_base64);
          if (!match) return Response.json({ error: "Arquivo inválido" }, { status: 400 });
          const [, mime, b64] = match;
          const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
          if (!allowed.includes(mime))
            return Response.json({ error: "Envie imagem ou PDF" }, { status: 400 });
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          if (bytes.byteLength > 5 * 1024 * 1024)
            return Response.json({ error: "Arquivo acima de 5MB" }, { status: 400 });
          if (!fileSignatureMatchesMime(bytes, mime))
            return Response.json(
              { error: "O conteúdo do arquivo não corresponde ao formato informado" },
              { status: 400 },
            );
          const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1];
          const path = `${appt.company_id}/comprovantes/${appointment_id}-${Date.now()}.${ext}`;
          const { error: upErr } = await supabaseAdmin.storage
            .from("company-assets")
            .upload(path, bytes, { contentType: mime, upsert: false });
          if (upErr)
            return Response.json({ error: "Falha ao enviar comprovante" }, { status: 500 });
          proofUrl = path;
        }

        if (!proofUrl && !transaction_ref)
          return Response.json(
            { error: "Anexe o comprovante ou informe o identificador" },
            { status: 400 },
          );

        if (existing) {
          // Não apaga o comprovante já enviado quando o cliente reenvia só o identificador
          const patch: Record<string, unknown> = { status: "pending" };
          if (proofUrl) patch.proof_url = proofUrl;
          if (transaction_ref) patch.transaction_ref = transaction_ref;
          await supabaseAdmin
            .from("appointment_payments")
            .update(patch as any)
            .eq("id", existing.id);
        } else {
          const { error } = await supabaseAdmin.from("appointment_payments").insert({
            company_id: appt.company_id,
            appointment_id,
            kind: "deposit",
            amount_cents: amount,
            method: "pix",
            status: "pending",
            proof_url: proofUrl,
            transaction_ref: transaction_ref || null,
          } as any);
          if (error) return Response.json({ error: error.message }, { status: 500 });
        }

        await supabaseAdmin.from("notifications").insert({
          company_id: appt.company_id,
          kind: "deposit_proof",
          title: "Comprovante de sinal recebido",
          body: "Um cliente enviou o comprovante do pagamento antecipado.",
          link: "/app/payments",
          metadata: { appointment_id },
        } as any);

        return Response.json({ ok: true, status: "awaiting_approval" });
      },
    },
  },
});
