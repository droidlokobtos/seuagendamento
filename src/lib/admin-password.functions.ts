import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ResetInput = z.object({
  email: z.string().trim().email().max(255),
  redirect_to: z.string().url().max(1000),
});

export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResetInput.parse(input))
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error: adminError } = await context.supabase.rpc("is_super_admin");
    if (adminError) throw new Error(adminError.message);
    if (!isAdmin) throw new Error("Apenas Admin Master pode solicitar redefinição de senha.");

    const email = data.email.toLowerCase();
    const { error } = await context.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: data.redirect_to,
    });
    if (error) throw new Error(error.message);

    await context.supabase.from("admin_access_logs").insert({
      user_id: context.userId,
      email,
      event: "password_reset_email_requested",
      metadata: { redirect_to: data.redirect_to },
    });

    return { ok: true, email };
  });
