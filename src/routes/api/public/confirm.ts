import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Endpoint público da página de confirmação (`/confirmar/<token>`).
 * GET  ?token=...  → dados do agendamento
 * POST { token, action: "confirm" | "cancel", reason? }
 *
 * O token é único, não reutilizável e expira automaticamente após o horário
 * do agendamento.
 */
const bodySchema = z.object({
  token: z.string().min(6).max(64),
  action: z.enum(["confirm", "cancel"]),
  reason: z.string().max(500).optional(),
});

export const Route = createFileRoute("/api/public/confirm")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (!token) return Response.json({ error: "Token ausente" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conf } = await supabaseAdmin
          .from("appointment_confirmations")
          .select("id, status, expires_at, responded_at, appointment_id, company_id, cancel_reason")
          .eq("token", token)
          .maybeSingle();

        if (!conf) return Response.json({ error: "Link inválido" }, { status: 404 });

        const expired = new Date(conf.expires_at).getTime() < Date.now();

        const [{ data: appt }, { data: company }] = await Promise.all([
          supabaseAdmin
            .from("appointments")
            .select("id, starts_at, status, customer_id, staff_id")
            .eq("id", conf.appointment_id)
            .maybeSingle(),
          supabaseAdmin
            .from("companies")
            .select("name, logo_url, slug, phone")
            .eq("id", conf.company_id)
            .maybeSingle(),
        ]);

        const [{ data: cust }, { data: stf }, { data: svcs }] = await Promise.all([
          appt?.customer_id
            ? supabaseAdmin
                .from("customers")
                .select("name, phone")
                .eq("id", appt.customer_id)
                .maybeSingle()
            : Promise.resolve({ data: null } as any),
          appt?.staff_id
            ? supabaseAdmin.from("staff").select("name").eq("id", appt.staff_id).maybeSingle()
            : Promise.resolve({ data: null } as any),
          appt
            ? supabaseAdmin
                .from("appointment_services")
                .select("services(name)")
                .eq("appointment_id", appt.id)
            : Promise.resolve({ data: [] } as any),
        ]);

        const maskPhone = (p?: string | null) => {
          const d = (p ?? "").replace(/\D/g, "");
          return d ? `(${d.slice(-11, -9) || "  "}) ****-${d.slice(-4)}` : "—";
        };

        return Response.json({
          status: conf.status,
          expired,
          respondedAt: conf.responded_at,
          cancelReason: conf.cancel_reason,
          company: {
            name: company?.name ?? "",
            logo_url: company?.logo_url ?? null,
            slug: company?.slug ?? null,
          },
          appointment: {
            startsAt: appt?.starts_at ?? null,
            status: appt?.status ?? null,
            customerName: cust?.name ?? "",
            customerPhone: maskPhone(cust?.phone),
            staffName: stf?.name ?? "Equipe",
            services: (svcs ?? []).map((r: any) => r.services?.name).filter(Boolean),
          },
        });
      },

      POST: async ({ request }) => {
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
        const { token, action, reason } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conf } = await supabaseAdmin
          .from("appointment_confirmations")
          .select("id, company_id, appointment_id, status, expires_at")
          .eq("token", token)
          .maybeSingle();

        if (!conf) return Response.json({ error: "Link inválido" }, { status: 404 });
        if (["confirmed", "cancelled"].includes(conf.status)) {
          return Response.json({ error: "Este link já foi utilizado" }, { status: 409 });
        }
        if (new Date(conf.expires_at).getTime() < Date.now()) {
          await supabaseAdmin
            .from("appointment_confirmations")
            .update({ status: "expired" })
            .eq("id", conf.id);
          return Response.json({ error: "Link expirado" }, { status: 410 });
        }

        // Não deixa confirmar/cancelar agendamento já finalizado ou encerrado pela empresa
        const { data: current } = await supabaseAdmin
          .from("appointments")
          .select("status")
          .eq("id", conf.appointment_id)
          .maybeSingle();
        const closed = [
          "completed",
          "cancelled",
          "cancelled_by_company",
          "cancelled_by_customer",
          "no_show",
        ];
        if (current && closed.includes(current.status)) {
          await supabaseAdmin
            .from("appointment_confirmations")
            .update({ status: "expired" })
            .eq("id", conf.id);
          return Response.json(
            { error: "Este agendamento não está mais disponível para confirmação." },
            { status: 409 },
          );
        }

        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
          null;
        const ua = request.headers.get("user-agent");
        const now = new Date().toISOString();

        const newApptStatus = action === "confirm" ? "confirmed" : "cancelled_by_customer";

        const { data: claimed, error: claimError } = await supabaseAdmin
          .from("appointment_confirmations")
          .update({
            status: action === "confirm" ? "confirmed" : "cancelled",
            response: action,
            responded_at: now,
            cancel_reason: action === "cancel" ? (reason ?? null) : null,
            response_ip: ip,
            response_user_agent: ua,
          } as any)
          .eq("id", conf.id)
          .eq("status", conf.status)
          .select("id")
          .maybeSingle();

        if (claimError || !claimed) {
          return Response.json({ error: "Este link já foi utilizado" }, { status: 409 });
        }

        await supabaseAdmin
          .from("appointments")
          .update({ status: newApptStatus } as any)
          .eq("id", conf.appointment_id);

        const { data: appt } = await supabaseAdmin
          .from("appointments")
          .select("starts_at, customer_id")
          .eq("id", conf.appointment_id)
          .maybeSingle();
        const { data: cust } = appt?.customer_id
          ? await supabaseAdmin
              .from("customers")
              .select("name")
              .eq("id", appt.customer_id)
              .maybeSingle()
          : { data: null as any };

        await supabaseAdmin.from("messaging_logs").insert({
          company_id: conf.company_id,
          appointment_id: conf.appointment_id,
          confirmation_id: conf.id,
          channel: "link",
          event: action === "confirm" ? "confirmed" : "cancelled",
          status: action === "confirm" ? "confirmed" : "cancelled",
          detail:
            action === "cancel" ? (reason ?? "Cancelado pelo cliente") : "Confirmado pelo cliente",
          ip,
          user_agent: ua,
        } as any);

        await supabaseAdmin.from("notifications").insert({
          company_id: conf.company_id,
          kind:
            action === "confirm" ? "appointment_confirmed" : "appointment_cancelled_by_customer",
          title: action === "confirm" ? "Agendamento confirmado" : "Cancelado pelo cliente",
          body: `${cust?.name ?? "Cliente"}${
            appt?.starts_at
              ? ` · ${new Date(appt.starts_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Sao_Paulo",
                })}`
              : ""
          }${action === "cancel" && reason ? ` · ${reason}` : ""}`,
          link: "/app/agenda",
          metadata: { appointment_id: conf.appointment_id, confirmation_id: conf.id },
        } as any);

        return Response.json({ ok: true, status: newApptStatus });
      },
    },
  },
});
