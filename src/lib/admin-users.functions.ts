import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    email: z.string().email(),
    new_password: z.string().min(8),
  }).parse(data))
  .handler(async ({ context, data }) => {
    // Only super_admin can reset arbitrary passwords
    const { data: isAdmin } = await context.supabase.rpc("is_super_admin");
    if (!isAdmin) throw new Error("Apenas Admin Master pode redefinir senhas.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Find user by email
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw listErr;
    const user = list.users.find((u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase());
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
    const { data: isAdmin } = await context.supabase.rpc("is_super_admin");
    if (!isAdmin) throw new Error("Apenas Admin Master pode excluir empresas.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: company, error: fetchErr } = await supabaseAdmin
      .from("companies")
      .select("id, name")
      .eq("id", data.company_id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!company) throw new Error("Empresa não encontrada.");

    // Block deletion when child companies (franchises) reference this one
    const { count: childCount } = await supabaseAdmin
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("parent_company_id", data.company_id);
    if ((childCount ?? 0) > 0) {
      throw new Error(`Não é possível excluir: existem ${childCount} unidade(s) vinculada(s) a esta empresa. Remova ou desvincule-as antes.`);
    }

    const { error: delErr } = await supabaseAdmin.from("companies").delete().eq("id", data.company_id);
    if (delErr) throw new Error(`Falha ao excluir: ${delErr.message}`);

    await context.supabase.from("admin_access_logs").insert({
      user_id: context.userId,
      email: null,
      event: "delete_company",
      metadata: { company_id: company.id, company_name: company.name },
    });

    return { ok: true };
  });
