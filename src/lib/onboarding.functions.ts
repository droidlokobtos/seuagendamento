import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
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
  niche_id: z.string().uuid(),
});

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "empresa";
}

export const createSelfServiceTrialCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => Input.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { count } = await supabaseAdmin.from("company_users").select("company_id", { count: "exact", head: true }).eq("user_id", userId).eq("active", true);
    if ((count ?? 0) > 0) throw new Error("Sua conta já está vinculada a uma empresa.");

    const [{ data: authUser }, { data: settings }, { data: proPlan }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(userId),
      supabaseAdmin.from("platform_settings").select("*").eq("id", true).maybeSingle(),
      supabaseAdmin.from("subscription_plans").select("code,monthly_cents").eq("code", "pro").eq("active", true).maybeSingle(),
    ]);
    if (!authUser.user) throw new Error("Usuário não encontrado.");
    if (!proPlan) throw new Error("O plano Pro não está disponível no momento.");

    const trialDays = Math.max(1, Math.min(365, Number((settings as any)?.default_trial_days ?? 15)));
    const start = new Date();
    const end = new Date(start.getTime() + trialDays * 86400000);
    const email = authUser.user.email?.toLowerCase() ?? null;

    const base = slugify(data.company_name);
    let slug = base;
    for (let i = 0; i < 20; i++) {
      const { data: exists } = await supabaseAdmin.from("companies").select("id").eq("slug", slug).maybeSingle();
      if (!exists) break;
      slug = `${base}-${i + 2}`;
    }

    const { data: company, error: companyError } = await supabaseAdmin.from("companies").insert({
      name: data.company_name,
      slug,
      niche_id: data.niche_id,
      email,
      owner_name: data.owner_name,
      responsible_name: data.owner_name,
      owner_whatsapp: data.phone,
      phone: data.phone,
      whatsapp: data.phone,
      contracted_plan: "Pro - teste gratuito",
      plan_code: "pro",
      monthly_fee: (proPlan.monthly_cents ?? 0) / 100,
      is_trial: true,
      trial_days: trialDays,
      trial_started_at: start.toISOString().slice(0, 10),
      trial_ends_at: end.toISOString().slice(0, 10),
      status: "trial",
      next_due_at: end.toISOString().slice(0, 10),
    } as any).select("id,slug,trial_ends_at").single();
    if (companyError) throw new Error(`Não foi possível criar a empresa: ${companyError.message}`);

    await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: data.owner_name, phone: data.phone } as any, { onConflict: "id" });
    await supabaseAdmin.from("company_users").upsert({ company_id: company.id, user_id: userId, role: "company_admin", active: true, permissions: {} } as any, { onConflict: "company_id,user_id" });
    await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "company_admin" } as any, { onConflict: "user_id,role" });
    await supabaseAdmin.from("admin_access_logs").insert({ user_id: userId, email, event: "self_service_trial_created", metadata: { company_id: company.id, plan_code: "pro", trial_days: trialDays, trial_ends_at: company.trial_ends_at } } as any);

    return { ok: true, company_id: company.id, slug: company.slug, trial_days: trialDays, trial_ends_at: company.trial_ends_at };
  });
