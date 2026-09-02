import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createReseller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(120),
        email: z.string().email(),
        phone: z.string().trim().max(30).optional(),
        commission_percent: z.number().min(0).max(100),
        payout_day: z.number().int().min(1).max(28),
        pix_key: z.string().trim().max(180).optional(),
        password: z.string().min(8).max(72),
      })
      .parse(v),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_super_admin");
    if (!isAdmin) throw new Error("Acesso negado");
    const { error: schemaError } = await (context.supabase.from as any)("resellers")
      .select("id")
      .limit(1);
    if (schemaError) {
      throw new Error(
        "O banco do módulo de revendedores ainda está sendo atualizado no Lovable Cloud.",
      );
    }
    const { createUserWithPublicSignup } = await import("@/lib/public-signup.server");
    const user = await createUserWithPublicSignup({
      email: data.email.toLowerCase(),
      password: data.password,
      fullName: data.name,
    });
    const { error } = await (context.supabase.from as any)("resellers").insert({
      user_id: user.userId,
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone || null,
      commission_percent: data.commission_percent,
      payout_day: data.payout_day,
      pix_key: data.pix_key || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
