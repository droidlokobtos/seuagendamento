import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMyBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // dados de vitrine sempre lidos pelo caminho público (colunas não sensíveis)
    const { publicSupabase } = await import("./public-portal.server");
    const { data: company, error: cErr } = await publicSupabase()
      .from("public_companies")
      .select("id,name,slug,primary_color,secondary_color,logo_url,banner_url,address,whatsapp,phone")
      .eq("slug", data.slug as string)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!company?.id) throw new Error("Empresa não encontrada");
    const companyId = company.id as string;

    const { data: customer } = await supabase
      .from("customers")
      .select("id,name,phone,email")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!customer) return { company, customer: null, bookings: [] as any[] };

    const { data: appts, error: aErr } = await supabase
      .from("appointments")
      .select("id,starts_at,ends_at,status,total_cents,discount_cents,notes,staff_id")
      .eq("customer_id", customer.id)
      .order("starts_at", { ascending: false })
      .limit(50);
    if (aErr) throw new Error(aErr.message);

    const apptIds = (appts ?? []).map((a) => a.id);
    const staffIds = Array.from(new Set((appts ?? []).map((a) => a.staff_id).filter(Boolean))) as string[];

    const [{ data: apSvcs }, { data: staffs }] = await Promise.all([
      apptIds.length
        ? supabase.from("appointment_services").select("appointment_id,service_id,price_cents,duration_min").in("appointment_id", apptIds)
        : Promise.resolve({ data: [] as any[] }),
      staffIds.length
        ? supabase.from("staff").select("id,name,photo_url").in("id", staffIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const svcIds = Array.from(new Set((apSvcs ?? []).map((x: any) => x.service_id)));
    const { data: svcs } = svcIds.length
      ? await supabase.from("services").select("id,name").in("id", svcIds)
      : { data: [] as any[] };

    const svcMap = new Map((svcs ?? []).map((s: any) => [s.id, s]));
    const staffMap = new Map((staffs ?? []).map((s: any) => [s.id, s]));
    const bookings = (appts ?? []).map((a) => ({
      ...a,
      staff: a.staff_id ? staffMap.get(a.staff_id) ?? null : null,
      services: (apSvcs ?? [])
        .filter((x: any) => x.appointment_id === a.id)
        .map((x: any) => ({ ...x, name: svcMap.get(x.service_id)?.name ?? "Serviço" })),
    }));

    return { company, customer, bookings };
  });

export const cancelMyBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { appointment_id: string }) =>
    z.object({ appointment_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: updated, error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" as any })
      .eq("id", data.appointment_id)
      .select("id,status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Não foi possível cancelar (janela mínima de 2h ou agendamento inexistente).");
    return { ok: true };
  });
