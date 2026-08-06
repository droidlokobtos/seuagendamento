import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CANCELLED = ["cancelled", "cancelled_by_customer", "cancelled_by_company", "no_show"];

async function assertAccess(
  supabase: any,
  companyId: string,
  keys: string[],
): Promise<void> {
  const { data: allowed, error } = await supabase.rpc("has_any_permission", {
    _company: companyId,
    _keys: keys,
  });
  if (error) throw new Error(error.message);
  if (!allowed) throw new Error("Sem permissão para esta ação.");

  const { data: blocked } = await supabase.rpc("is_company_blocked", { _company: companyId });
  if (blocked) throw new Error("Acesso bloqueado: assinatura suspensa ou período de teste expirado.");
}

/** Finaliza o atendimento de forma segura, sem que etapas acessórias impeçam a conclusão. */
export const completeAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { appointmentId: string }) =>
    z.object({ appointmentId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: appt, error } = await supabase
      .from("appointments")
      .select("id,company_id,status,starts_at,ends_at,total_cents,discount_cents,surcharge_cents,paid_cents,customer_id,staff_id")
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!appt) throw new Error("Atendimento não encontrado.");
    await assertAccess(supabase, appt.company_id as string, ["agendamentos", "agenda"]);

    if (appt.status === "completed") {
      return { ok: true, alreadyCompleted: true, appointmentId: appt.id };
    }
    if (CANCELLED.includes(String(appt.status))) {
      throw new Error("Atendimento cancelado não pode ser finalizado.");
    }

    const { error: upErr } = await supabase
      .from("appointments")
      .update({ status: "completed" as never })
      .eq("id", appt.id);
    if (upErr) throw new Error(upErr.message);

    const { data: fresh } = await supabase
      .from("appointments")
      .select("id,status,completed_at,total_cents,paid_cents,payment_status")
      .eq("id", appt.id)
      .maybeSingle();

    const { count: commissionCount } = await supabase
      .from("commissions")
      .select("id", { count: "exact", head: true })
      .eq("appointment_id", appt.id);

    return {
      ok: true,
      alreadyCompleted: false,
      appointmentId: appt.id,
      completedAt: (fresh as any)?.completed_at ?? null,
      paymentStatus: (fresh as any)?.payment_status ?? null,
      commissions: commissionCount ?? 0,
    };
  });

/** Adiciona um serviço a um atendimento em andamento, recalculando valor, duração e conflitos. */
export const addAppointmentService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    appointmentId: string;
    serviceId: string;
    staffId?: string | null;
    notes?: string | null;
  }) =>
    z
      .object({
        appointmentId: z.string().uuid(),
        serviceId: z.string().uuid(),
        staffId: z.string().uuid().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: appt, error } = await supabase
      .from("appointments")
      .select("id,company_id,status,starts_at,ends_at,total_cents,notes,staff_id")
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!appt) throw new Error("Atendimento não encontrado.");
    await assertAccess(supabase, appt.company_id as string, ["agendamentos", "agenda"]);

    if (!["in_progress", "scheduled", "confirmed"].includes(String(appt.status))) {
      throw new Error("Só é possível adicionar serviços a atendimentos abertos ou em andamento.");
    }

    const { data: service, error: sErr } = await supabase
      .from("services")
      .select("id,name,duration_min,price_cents,active")
      .eq("id", data.serviceId)
      .eq("company_id", appt.company_id as string)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!service || service.active === false) throw new Error("Serviço indisponível.");

    const duration = Number(service.duration_min ?? 30);
    const price = Number(service.price_cents ?? 0);
    const currentEnd = new Date((appt.ends_at as string) ?? (appt.starts_at as string));
    const newEnd = new Date(currentEnd.getTime() + duration * 60_000);
    const staffId = (data.staffId ?? appt.staff_id) as string | null;

    // Conflito de agenda com o novo tempo previsto
    if (staffId) {
      const { data: clashes } = await supabase
        .from("appointments")
        .select("id,starts_at,ends_at,status")
        .eq("company_id", appt.company_id as string)
        .eq("staff_id", staffId)
        .neq("id", appt.id)
        .lt("starts_at", newEnd.toISOString())
        .gt("ends_at", currentEnd.toISOString());
      const blocking = (clashes ?? []).filter((c: any) => !CANCELLED.includes(String(c.status)));
      if (blocking.length) {
        const at = new Date(blocking[0].starts_at).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        throw new Error(`Conflito de agenda: já existe atendimento às ${at} para este profissional.`);
      }
    }

    const { error: insErr } = await supabase.from("appointment_services").insert({
      appointment_id: appt.id,
      service_id: service.id,
      price_cents: price,
      duration_min: duration,
    } as never);
    if (insErr) throw new Error(insErr.message);

    const noteLine = data.notes?.trim()
      ? `\n+ ${service.name}: ${data.notes.trim()}`
      : `\n+ ${service.name} adicionado durante o atendimento`;

    const { error: updErr } = await supabase
      .from("appointments")
      .update({
        total_cents: Number(appt.total_cents ?? 0) + price,
        ends_at: newEnd.toISOString(),
        notes: `${(appt.notes as string) ?? ""}${noteLine}`.trim(),
        ...(data.staffId ? { staff_id: data.staffId } : {}),
      } as never)
      .eq("id", appt.id);
    if (updErr) throw new Error(updErr.message);

    return {
      ok: true,
      appointmentId: appt.id,
      serviceName: service.name,
      addedCents: price,
      addedMinutes: duration,
      newEndsAt: newEnd.toISOString(),
    };
  });
