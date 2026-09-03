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

    const email = data.email.toLowerCase();
    const { error: schemaError } = await (context.supabase.from as any)("resellers")
      .select("id")
      .limit(1);
    if (schemaError) {
      throw new Error(
        "O banco do módulo de revendedores ainda está sendo atualizado no Lovable Cloud.",
      );
    }

    const [{ supabaseAdmin }, { findAuthUserByEmail }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/admin-users.server"),
    ]);

    const { data: existingReseller } = await (context.supabase.from as any)("resellers")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingReseller) throw new Error("Este e-mail já está cadastrado como revendedor.");

    let authUser = await findAuthUserByEmail(email);
    let createdUserId: string | null = null;
    const reusedExistingAccount = !!authUser;

    if (authUser) {
      const [{ count: memberships }, { count: superAdminRoles }, { data: linkedReseller }] =
        await Promise.all([
          supabaseAdmin
            .from("company_users")
            .select("id", { count: "exact", head: true })
            .eq("user_id", authUser.id)
            .eq("active", true),
          supabaseAdmin
            .from("user_roles")
            .select("id", { count: "exact", head: true })
            .eq("user_id", authUser.id)
            .eq("role", "super_admin"),
          (supabaseAdmin.from as any)("resellers")
            .select("id")
            .eq("user_id", authUser.id)
            .maybeSingle(),
        ]);

      if (linkedReseller) throw new Error("Esta conta já possui um perfil de revendedor.");
      if ((superAdminRoles ?? 0) > 0)
        throw new Error("O e-mail do Admin Master não pode ser usado como revendedor.");
      if ((memberships ?? 0) > 0)
        throw new Error(
          "Este e-mail já está vinculado a uma empresa. Use outro e-mail para o revendedor.",
        );
    } else {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.name },
      });
      if (createError || !created.user) {
        if (/already|registered|exists/i.test(createError?.message ?? "")) {
          authUser = await findAuthUserByEmail(email);
        }
        if (!authUser) throw new Error(createError?.message ?? "Não foi possível criar o acesso.");
      } else {
        authUser = created.user;
        createdUserId = created.user.id;
        await supabaseAdmin
          .from("profiles")
          .update({ must_change_password: true })
          .eq("id", created.user.id);
      }
    }

    if (!authUser) throw new Error("Não foi possível localizar ou criar o acesso do revendedor.");

    const { error } = await (context.supabase.from as any)("resellers").insert({
      user_id: authUser.id,
      name: data.name,
      email,
      phone: data.phone || null,
      commission_percent: data.commission_percent,
      payout_day: data.payout_day,
      pix_key: data.pix_key || null,
    });
    if (error) {
      if (createdUserId) await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      if (/duplicate|unique/i.test(error.message))
        throw new Error("Este e-mail já está cadastrado como revendedor.");
      throw new Error(error.message);
    }

    return { ok: true, reusedExistingAccount };
  });
