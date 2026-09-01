import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    email: z.string().email(),
    phone: z.string().min(10).optional(),
    new_password: z.string().min(8),
  }).parse(data))
  .handler(async ({ context, data }) => {
    // Only super_admin can reset arbitrary passwords
    const { data: isAdmin } = await context.supabase.rpc("is_super_admin");
    if (!isAdmin) throw new Error("Apenas Admin Master pode redefinir senhas.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Find user by email
    const { findAuthUserByEmail } = await import("@/lib/admin-users.server");
    const user = await findAuthUserByEmail(data.email);
    if (!user) throw new Error("Usuário não encontrado com esse e-mail.");

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: data.new_password,
    });
    if (updErr) throw updErr;

    // Force password change on next login
    await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", user.id);

    // Audit
    await context.supabase.from("admin_access_logs").insert({
      user_id: context.userId,
      email: data.email,
      event: "reset_password",
      metadata: { target_user_id: user.id },
    });

    return { ok: true };
  });

export const deleteCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ company_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error: adminError } = await context.supabase.rpc("is_super_admin");
    if (adminError) throw new Error(adminError.message);
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
  .inputValidator((data) => z.object({
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
    const { data: isAdmin } = await context.supabase.rpc("is_super_admin");
    if (!isAdmin) throw new Error("Apenas Admin Master pode criar empresas.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    // Reuse existing auth user if the e-mail already exists, otherwise create one
    let userId: string | null = null;
    const { findAuthUserByEmail } = await import("@/lib/admin-users.server");
    const existing = await findAuthUserByEmail(email);
    const tempPassword = data.temp_password;

    if (existing) {
      userId = existing.id;
      // Ensure existing user is confirmed and set the shared temp password so admin can hand it over
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: tempPassword,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata ?? {}), full_name: data.owner_name },
      });
      if (updErr) throw new Error(`Falha ao configurar usuário existente: ${updErr.message}`);
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: data.owner_name },
      });
      if (createErr) throw createErr;
      if (!created.user) throw new Error("Não foi possível criar o administrador da empresa.");
      userId = created.user.id;
    }

    // Force password change on first login
    if (!userId) throw new Error("Não foi possível configurar o administrador da empresa.");
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      full_name: data.owner_name,
      phone: data.phone,
      must_change_password: true,
    } as any, { onConflict: "id" });

    // Create the company
    const { data: company, error: cErr } = await supabaseAdmin
      .from("companies")
      .insert({
        name: data.name,
        slug: data.slug,
        niche_id: data.niche_id,
        sub_niche_id: data.sub_niche_id ?? null,
        email,
        owner_name: data.owner_name,
        responsible_name: data.owner_name,
        owner_whatsapp: data.phone,
        monthly_fee: data.monthly_fee,
        phone: data.phone,
        whatsapp: data.phone,
        contracted_plan: data.contracted_plan,
        status: data.status,
        next_due_at: data.next_due_at,
        admin_notes: data.admin_notes ?? null,
      } as any)
      .select("id")
      .single();
    if (cErr) throw new Error(`Falha ao criar empresa: ${cErr.message}`);

    // Wire admin membership + role (idempotent)
    await supabaseAdmin.from("company_users").upsert(
      { company_id: company.id, user_id: userId, role: "company_admin", active: true, permissions: {} },
      { onConflict: "company_id,user_id" },
    );
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: "company_admin" },
      { onConflict: "user_id,role" },
    );

    // Audit
    await context.supabase.from("admin_access_logs").insert({
      user_id: context.userId,
      email,
      event: "create_company",
      metadata: { company_id: company.id, admin_user_id: userId, created_user: !existing },
    });

    return {
      ok: true,
      company_id: company.id,
      admin_user_id: userId,
      email,
      temp_password: tempPassword,
    };
  });

/** Admin Master: define plano de assinatura e/ou período de teste de uma empresa. */
export const setCompanyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        company_id: z.string().uuid(),
        plan_code: z.string().min(1).max(50).nullable().optional(),
        monthly_fee: z.number().min(0).nullable().optional(),
        trial: z.boolean().optional(),
        trial_days: z.number().int().min(1).max(365).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_super_admin");
    if (!isAdmin) throw new Error("Apenas Admin Master pode alterar planos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, unknown> = {};
    if (data.plan_code !== undefined) {
      if (data.plan_code) {
        const { data: plan } = await supabaseAdmin
          .from("subscription_plans")
          .select("code, monthly_cents")
          .eq("code", data.plan_code)
          .maybeSingle();
        if (!plan) throw new Error("Plano inexistente.");
        patch['plan_code'] = plan.code;
        if (data.monthly_fee === undefined) patch['monthly_fee'] = (plan.monthly_cents ?? 0) / 100;
      } else {
        patch['plan_code'] = null;
      }
    }
    if (data.monthly_fee !== undefined && data.monthly_fee !== null) patch['monthly_fee'] = data.monthly_fee;

    if (data.trial === true) {
      const days = data.trial_days ?? 14;
      const start = new Date();
      const end = new Date(start.getTime() + days * 86400000);
      patch['is_trial'] = true;
      patch['trial_days'] = days;
      patch['trial_started_at'] = start.toISOString();
      patch['trial_ends_at'] = end.toISOString();
      patch['status'] = "trial";
      patch['next_due_at'] = end.toISOString().slice(0, 10);
    } else if (data.trial === false) {
      patch['is_trial'] = false;
      patch['trial_ends_at'] = null;
      patch['status'] = "active";
    }

    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabaseAdmin.from("companies").update(patch as never).eq("id", data.company_id);
    if (error) throw new Error(error.message);

    await context.supabase.from("admin_access_logs").insert({
      user_id: context.userId,
      email: "",
      event: "update_company_plan",
      metadata: { company_id: data.company_id, ...patch } as never,
    });

    return { ok: true };
  });
