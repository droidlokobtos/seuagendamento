import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { guardPublicRequest, rateLimitResponse } from "@/lib/public-api-protection.server";

/**
 * Profissionais habilitados e disponíveis para os serviços/horário escolhidos.
 *
 * GET /api/public/staff?slug=...&service_ids=a,b&date=YYYY-MM-DD&time=HH:MM&starts_at=ISO
 *
 * Todo o filtro é feito no backend, em uma única passagem:
 *  1. empresa correta (multiempresa) e funcionário ativo;
 *  2. vínculo na tabela staff_services com TODOS os serviços escolhidos
 *     (serviços sem nenhum vínculo cadastrado não restringem a lista);
 *  3. jornada do profissional (staff_schedules): dia da semana + horário;
 *  4. bloqueios de agenda / folgas / férias (time_blocks);
 *  5. horários já ocupados (appointments não cancelados).
 */

const qSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  service_ids: z.array(z.string().uuid()).min(1).max(20),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  starts_at: z.string().datetime().optional(),
});

const CANCELLED = ["cancelled", "cancelled_by_customer", "cancelled_by_company", "no_show"];

export const Route = createFileRoute("/api/public/staff")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = qSchema.safeParse({
          slug: url.searchParams.get("slug") ?? "",
          service_ids: (url.searchParams.get("service_ids") ?? "").split(",").filter(Boolean),
          date: url.searchParams.get("date") ?? undefined,
          time: url.searchParams.get("time") ?? undefined,
          starts_at: url.searchParams.get("starts_at") ?? undefined,
        });
        if (!parsed.success)
          return Response.json({ error: "Parâmetros inválidos" }, { status: 400 });
        const { slug, service_ids, date, time, starts_at } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const guard = await guardPublicRequest(supabaseAdmin, request, {
          scope: "staff:availability",
          limit: 60,
          windowSeconds: 300,
        });
        if (!guard.allowed) return rateLimitResponse(guard.retryAfter);

        const { data: company } = await supabaseAdmin
          .from("companies")
          .select("id, status, online_booking_enabled")
          .eq("slug", slug)
          .maybeSingle();
        if (!company) return Response.json({ error: "Empresa não encontrada" }, { status: 404 });

        // Serviços válidos e ativos da empresa
        const { data: services } = await supabaseAdmin
          .from("services")
          .select("id, duration_min")
          .eq("company_id", company.id)
          .eq("active", true)
          .in("id", service_ids);
        const validServiceIds = (services ?? []).map((s) => s.id);
        if (!validServiceIds.length) return Response.json({ staff: [], reason: "no_services" });
        const totalMin = (services ?? []).reduce((a, s) => a + (s.duration_min ?? 0), 0);

        // Funcionários ativos da empresa + vínculos com os serviços (uma consulta cada)
        const [{ data: staffRows }, { data: links }] = await Promise.all([
          supabaseAdmin
            .from("staff")
            .select("id, name, role_title, photo_url, color")
            .eq("company_id", company.id)
            .eq("active", true)
            .order("name"),
          supabaseAdmin
            .from("staff_services")
            .select("staff_id, service_id")
            .in("service_id", validServiceIds),
        ]);

        const staffList = staffRows ?? [];
        if (!staffList.length) return Response.json({ staff: [], reason: "no_staff" });
        const staffIds = new Set(staffList.map((s) => s.id));

        // Somente vínculos de funcionários desta empresa
        const linksByStaff = new Map<string, Set<string>>();
        const linkedServices = new Set<string>();
        for (const l of links ?? []) {
          if (!staffIds.has(l.staff_id)) continue;
          linkedServices.add(l.service_id);
          if (!linksByStaff.has(l.staff_id)) linksByStaff.set(l.staff_id, new Set());
          linksByStaff.get(l.staff_id)!.add(l.service_id);
        }
        // Serviços sem nenhum profissional vinculado não restringem a lista (compatibilidade)
        const required = validServiceIds.filter((id) => linkedServices.has(id));

        let eligible = staffList.filter((s) =>
          required.every((id) => linksByStaff.get(s.id)?.has(id)),
        );
        if (!eligible.length) {
          return Response.json({ staff: [], reason: required.length ? "no_link" : "no_staff" });
        }

        // Sem data/horário ainda: devolve apenas os habilitados
        if (!date || !time || !starts_at) {
          return Response.json({ staff: eligible, reason: null });
        }

        const startMs = new Date(starts_at).getTime();
        const endMs = startMs + totalMin * 60_000;
        const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
        const [th, tm] = time.split(":").map(Number);
        const slotStartMin = th * 60 + tm;
        const slotEndMin = slotStartMin + totalMin;

        const eligibleIds = eligible.map((s) => s.id);
        const dayFrom = new Date(startMs - 24 * 3600 * 1000).toISOString();
        const dayTo = new Date(endMs + 24 * 3600 * 1000).toISOString();

        const [{ data: schedules }, { data: blocks }, { data: appts }] = await Promise.all([
          supabaseAdmin
            .from("staff_schedules")
            .select("staff_id, weekday, start_time, end_time")
            .in("staff_id", eligibleIds),
          supabaseAdmin
            .from("time_blocks")
            .select("staff_id, starts_at, ends_at")
            .eq("company_id", company.id)
            .lt("starts_at", dayTo)
            .gt("ends_at", dayFrom),
          supabaseAdmin
            .from("appointments")
            .select("staff_id, starts_at, ends_at, status")
            .eq("company_id", company.id)
            .gte("starts_at", dayFrom)
            .lte("starts_at", dayTo),
        ]);

        const hasSchedule = new Set((schedules ?? []).map((s) => s.staff_id));
        const toMin = (t: string) => {
          const [h, m] = t.split(":").map(Number);
          return h * 60 + m;
        };

        const busy = (appts ?? []).filter((a) => !CANCELLED.includes(String(a.status)));

        eligible = eligible.filter((s) => {
          // 3. jornada de trabalho (quando cadastrada). Sem jornada = segue o horário da empresa.
          if (hasSchedule.has(s.id)) {
            const windows = (schedules ?? []).filter(
              (x) => x.staff_id === s.id && x.weekday === weekday,
            );
            if (!windows.length) return false; // folga nesse dia da semana
            const fits = windows.some(
              (w) => toMin(w.start_time) <= slotStartMin && toMin(w.end_time) >= slotEndMin,
            );
            if (!fits) return false; // fora da jornada / intervalo de almoço
          }

          // 4. bloqueios da empresa ou do próprio profissional (folgas, férias)
          const blocked = (blocks ?? []).some((b) => {
            if (b.staff_id && b.staff_id !== s.id) return false;
            const bs = new Date(b.starts_at).getTime();
            const be = new Date(b.ends_at).getTime();
            return startMs < be && endMs > bs;
          });
          if (blocked) return false;

          // 5. horários já ocupados
          const taken = busy.some((a) => {
            if (a.staff_id !== s.id) return false;
            const as = new Date(a.starts_at).getTime();
            const ae = a.ends_at ? new Date(a.ends_at).getTime() : as;
            return startMs < ae && endMs > as;
          });
          return !taken;
        });

        return Response.json({
          staff: eligible,
          reason: eligible.length ? null : "unavailable",
        });
      },
    },
  },
});
