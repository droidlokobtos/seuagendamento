import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ companyId: z.string().uuid() });

export const getOrCreateReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const [{ data: membership }, { data: superAdmin }] = await Promise.all([
      context.supabase
        .from("company_users")
        .select("company_id")
        .eq("company_id", data.companyId)
        .eq("user_id", context.userId)
        .eq("active", true)
        .maybeSingle(),
      context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("role", "super_admin")
        .maybeSingle(),
    ]);

    if (!membership && !superAdmin) throw new Error("Sem acesso a esta empresa.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = (supabaseAdmin.from as any)("company_referral_codes");
    const { data: current, error: readError } = await table
      .select("code")
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (current?.code) return String(current.code);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
      const { error } = await (supabaseAdmin.from as any)("company_referral_codes").insert({
        company_id: data.companyId,
        code,
      });
      if (!error) return code;

      const { data: created } = await (supabaseAdmin.from as any)("company_referral_codes")
        .select("code")
        .eq("company_id", data.companyId)
        .maybeSingle();
      if (created?.code) return String(created.code);
      if (error.code !== "23505") throw new Error(error.message);
    }

    throw new Error("Não foi possível gerar o código de indicação.");
  });
