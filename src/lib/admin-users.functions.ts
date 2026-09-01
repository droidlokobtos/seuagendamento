import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({
    email: z.string().email(),
    phone: z.string().min(10).optional(),
    new_password: z.string().min(8),
  }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error: adminError } = await context.supabase.rpc("is_super_admin");
    if (adminError) throw new Error(adminError.message);
    if (!isAdmin) throw new Error("Apenas Admin Master pode solicitar redefinição de senha.");

    const email = data.email.toLowerCase();
    const { error } = await context.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://seuagendamento.lovable.app/reset-password",
    });
    if (error) throw new Error(error.message);

    await context.supabase.from("admin_access_logs").insert({
      user_id: context.userId,
      email,
      event: "password_reset_email_requested",
      metadata: { method: "recovery_email" },
    });

    return { ok: true, mode: "recovery_email" };
  });

export const deleteCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ company_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_super_admin");
    if (!isAdmin) throw new Error("Apenas Admin Master pode excluir empresas.");

    const { data: result, error } = await (context.supabase as any).rpc(
      "delete_company_as_super_admin",
      { _company: data.company_id },
    );
    if (error) throw new Error(error.message);
    return result ?? { ok: true };
  });

export const createCompanyWithAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({
    name: z.string().trim().min(2).max(160),
    owner_name: z.string().trim().min(2).max(160),
    slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    niche_id: z.string().uuid(),
    sub_niche_id: z.string().uuid().nullable().optional(),
    email: z.string().trim().email().max(255),
    phone: z.string().transform((value, ctx) => {
      const digits = value.replace(/\D/g, "");
      if (!/^[1-9]{2}9\d{8}$/.test(digits)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe um celular brasileiro válido com DDD." });
        return z.NEVER;
      }
      return digits;
    }),
    monthly_fee: z.number().nonnegative(),
    temp_password: z.string().min(8).max(72),
    contracted_plan: z.string().trim().min(1).max(100),
    status: z.enum(["active", "due_soon", "overdue", "suspended"]),
    next_due_at: z.string().date(),
    admin_notes: z.string().trim().max(2000).nullable().optional(),
  }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error: adminError } = await context.supabase.rpc("is_super_admin");
    if (adminError) throw new Error(adminError.message);
    if (!isAdmin) throw new Error("Apenas Admin Master pode criar empresas.");

    const email = data.email.toLowerCase();
    const { createUserWithPublicSignup } = await import("@/lib/public-signup.server");
    const created = await createUserWithPublicSignup({
      email,
      password: data.temp_password,
      fullName: data.owner_name,
    });

    const { data: result, error } = await (context.supabase as any).rpc(
      "create_company_for_user_as_super_admin",
      {
        _user_id: created.userId,
        _name: data.name,
        _owner_name: data.owner_name,
        _slug: data.slug,
        _niche_id: data.niche_id,
        _sub_niche_id: data.sub_niche_id ?? null,
        _email: email,
        _phone: data.phone,
        _monthly_fee: data.monthly_fee,
        _contracted_plan: data.contracted_plan,
        _status: data.status,
        _next_due_at: data.next_due_at,
        _admin_notes: data.admin_notes ?? null,
      },
    );
    if (error) throw new Error(`Falha ao criar empresa: ${error.message}`);

    return {
      ok: true,
      company_id: result?.company_id,
      admin_user_id: created.userId,
      email,
      temp_password: data.temp_password,
      email_confirmation_required: !created.emailConfirmed && !created.hasSession,
    };
  });

export const setCompanyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z.object({
      company_id: z.string().uuid(),
      plan_code: z.string().min(1).max(50).nullable().optional(),
      monthly_fee: z.number().min(0).nullable().optional(),
      trial: z.boolean().optional(),
      trial_days: z.number().int().min(1).max(365).optional(),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error: adminError } = await context.supabase.rpc("is_super_admin");
    if (adminError) throw new Error(adminError.message);
    if (!isAdmin) throw new Error("Apenas Admin Master pode alterar planos.");

    const patch: Record<string, unknown> = {};
    if (data.plan_code !== undefined) {
      if (data.plan_code) {
        const { data: plan, error: planError } = await context.supabase
          .from("subscription_plans")
          .select("code, monthly_cents")
          .eq("code", data.plan_code)
          .maybeSingle();
        if (planError) throw new Error(planError.message);
        if (!plan) throw new Error("Plano inexistente.");
        patch["plan_code"] = plan.code;
        if (data.monthly_fee === undefined) patch["monthly_fee"] = (plan.monthly_cents ?? 0) / 100;
      } else {
        patch["plan_code"] = null;
      }
    }
    if (data.monthly_fee !== undefined && data.monthly_fee !== null) patch["monthly_fee"] = data.monthly_fee;

    if (data.trial === true) {
      const days = data.trial_days ?? 14;
      const start = new Date();
      const end = new Date(start.getTime() + days * 86400000);
      patch["is_trial"] = true;
      patch["trial_days"] = days;
      patch["trial_started_at"] = start.toISOString();
      patch["trial_ends_at"] = end.toISOString();
      patch["status"] = "trial";
      patch["next_due_at"] = end.toISOString().slice(0, 10);
    } else if (data.trial === false) {
      patch["is_trial"] = false;
      patch["trial_ends_at"] = null;
      patch["status"] = "active";
    }

    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await context.supabase
      .from("companies")
      .update(patch as never)
      .eq("id", data.company_id);
    if (error) throw new Error(error.message);

    await context.supabase.from("admin_access_logs").insert({
      user_id: context.userId,
      email: "",
      event: "update_company_plan",
      metadata: { company_id: data.company_id, ...patch } as never,
    });

    return { ok: true };
  });
