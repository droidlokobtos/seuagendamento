import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const RoleZ = z.enum(["company_admin", "staff", "receptionist"]);

const InviteZ = z.object({
  companyId: z.string().uuid(),
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(1).max(120),
  role: RoleZ,
});

async function assertAdmin(supabase: any, userId: string, companyId: string) {
  const { data: superAdmin } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (superAdmin) return;
  const { data: membership } = await supabase
    .from("company_users")
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!membership || membership.role !== "company_admin") {
    throw new Error("Sem permissão para gerenciar usuários desta empresa.");
  }
}

export const inviteCompanyUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InviteZ.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.companyId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find or invite auth user
    let userId: string | null = null;
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (existing) {
      userId = existing.id;
    } else {
      const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        data.email,
        { data: { full_name: data.fullName } },
      );
      if (invErr) throw new Error(invErr.message);
      userId = invited.user?.id ?? null;
    }
    if (!userId) throw new Error("Não foi possível criar o usuário.");

    // Ensure profile
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: data.fullName }, { onConflict: "id" });

    // Link membership
    const { error: linkErr } = await supabaseAdmin
      .from("company_users")
      .upsert(
        { company_id: data.companyId, user_id: userId, role: data.role },
        { onConflict: "company_id,user_id" },
      );
    if (linkErr) throw new Error(linkErr.message);

    return { ok: true, userId, wasInvited: !existing };
  });

const UpdateZ = z.object({
  companyId: z.string().uuid(),
  membershipId: z.string().uuid(),
  role: RoleZ,
});
export const updateCompanyUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateZ.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.companyId);
    const { error } = await context.supabase
      .from("company_users")
      .update({ role: data.role })
      .eq("id", data.membershipId)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const RemoveZ = z.object({
  companyId: z.string().uuid(),
  membershipId: z.string().uuid(),
});
export const removeCompanyUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RemoveZ.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.companyId);
    const { error } = await context.supabase
      .from("company_users")
      .delete()
      .eq("id", data.membershipId)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCompanyUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ companyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("company_users")
      .select("id,user_id,role,created_at")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.user_id);
    if (!ids.length) return [];
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id,full_name")
      .in("id", ids);
    // Emails require admin
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emailMap = new Map(usersList?.users?.map((u) => [u.id, u.email]) ?? []);
    return (rows ?? []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      role: r.role,
      createdAt: r.created_at,
      fullName: profiles?.find((p) => p.id === r.user_id)?.full_name ?? null,
      email: emailMap.get(r.user_id) ?? null,
    }));
  });
