import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SelfSignupInput = z.object({
  company_name: z.string().trim().min(2).max(160),
  owner_name: z.string().trim().min(2).max(160),
  phone: z.string().transform((value, ctx) => {
    const digits = value.replace(/\D/g, "");
    if (!/^[1-9]{2}9\d{8}$/.test(digits)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe um celular brasileiro válido com DDD." });
      return z.NEVER;
    }
    return digits;
  }),
});

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "empresa";
}

export const createOwnTrialCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SelfSignupInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from("company_users")
      .select("company_id")
      .eq("user_id", context.userId)
      .eq("active", true)
      .limit(1);
    if (membershipError) throw membershipError;
    if ((memberships ?? []).length > 0) throw new Error("Sua conta já está vinculada a uma empresa.");

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (authError) throw authError;
    const email = authUser.user?.email?.toLowerCase();
    if (!email) throw new Error("Não foi possível identificar o e-mail da sua conta.");

    const { data: settings } = await supabaseAdmin
      .from("platform_settings")
      .select("trial_days_default,trial_plan_code")
      .eq("id", true)
      .maybeSingle();

    const trialDays = Math.max(1, Math.min(365, Number((settings as any)?.trial_days_default ?? 15)));
    const configuredPlan = String((settings as any)?.trial_plan_code ?? "pro");
    const { data: plan } = await supabaseAdmin
      .from("subscription_plans")
      .select("code")
      .eq("code", configuredPlan)
      .eq("active", true)
      .maybeSingle();
    const planCode = plan?.code ?? "pro";

    const start = new Date();
    const end = new Date(start.getTime() + trialDays * 86400000);
    const slug = `${slugify(data.company_name)}-${crypto.randomUUID().slice(0, 6)}`;

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({
        name: data.company_name,
        slug,
        email,
        owner_name: data.owner_name,
        responsible_name: data.owner_name,
        owner_whatsapp: data.phone,
        phone: data.phone,
        whatsapp: data.phone,
        plan_code: planCode,
        contracted_plan: planCode,
        is_trial: true,
        trial_days: trialDays,
        trial_started_at: start.toISOString().slice(0, 10),
        trial_ends_at: end.toISOString().slice(0, 10),
        next_due_at: end.toISOString().slice(0, 10),
        status: "trial",
      } as any)
      .select("id,name,slug,trial_ends_at,plan_code")
      .single();
    if (companyError) throw new Error(`Não foi possível criar a empresa: ${companyError.message}`);

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: context.userId,
      full_name: data.owner_name,
      phone: data.phone,
    } as any, { onConflict: "id" });
    if (profileError) throw profileError;

    const { error: companyUserError } = await supabaseAdmin.from("company_users").upsert({
      company_id: company.id,
      user_id: context.userId,
      role: "company_admin",
      active: true,
      permissions: {},
    } as any, { onConflict: "company_id,user_id" });
    if (companyUserError) throw companyUserError;

    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert({
      user_id: context.userId,
      role: "company_admin",
    } as any, { onConflict: "user_id,role" });
    if (roleError) throw roleError;

    await supabaseAdmin.from("admin_access_logs").insert({
      user_id: context.userId,
      email,
      event: "self_signup_trial_company",
      metadata: { company_id: company.id, plan_code: planCode, trial_days: trialDays },
    } as any);

    return { ok: true, company_id: company.id, company_name: company.name, plan_code: planCode, trial_days: trialDays, trial_ends_at: company.trial_ends_at };
  });
