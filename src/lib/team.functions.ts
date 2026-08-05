import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const RoleZ = z.enum(["company_admin", "staff", "receptionist"]);
const PermsZ = z.record(z.string(), z.boolean());

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
    .select("role,active")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!membership || membership.role !== "company_admin" || membership.active === false) {
    throw new Error("Sem permissão para gerenciar usuários desta empresa.");
  }
}

async function audit(
  supabase: any,
  companyId: string,
  userId: string,
  action: string,
  entity: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("user_audit_log").insert({
    company_id: companyId,
    user_id: userId,
    action,
    entity,
    entity_id: entityId,
    metadata,
  });
}

const CreateZ = z.object({
  companyId: z.string().uuid(),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(1).max(120),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  role: RoleZ,
  permissions: PermsZ.default({}),
  staffId: z.string().uuid().nullable().optional(),
});

export const createCompanyUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateZ.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.companyId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { findAuthUserByEmail } = await import("@/lib/admin-users.server");
    const email = data.email.toLowerCase();

    const existing = await findAuthUserByEmail(email);
    let userId: string;

    if (existing) {
      // Um mesmo e-mail só pode pertencer a uma empresa
      const { data: otherLinks } = await supabaseAdmin
        .from("company_users")
        .select("company_id")
        .eq("user_id", existing.id);
      const other = (otherLinks ?? []).find((l: any) => l.company_id !== data.companyId);
      if (other) throw new Error("Este e-mail já pertence a outra empresa.");
      userId = existing.id;
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: data.password,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata ?? {}), full_name: data.fullName },
      });
      if (updErr) throw new Error(updErr.message);
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
      if (createErr) throw new Error(createErr.message);
      userId = created.user!.id;
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: data.fullName, must_change_password: false } as any, {
        onConflict: "id",
      });

    const { error: linkErr } = await supabaseAdmin.from("company_users").upsert(
      {
        company_id: data.companyId,
        user_id: userId,
        role: data.role,
        job_title: data.jobTitle ?? null,
        permissions: data.permissions,
        active: true,
        staff_id: data.staffId ?? null,
      } as any,
      { onConflict: "company_id,user_id" },
    );
    if (linkErr) throw new Error(linkErr.message);

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.role } as any, { onConflict: "user_id,role" });

    await audit(context.supabase, data.companyId, context.userId, "user_created", "company_users", userId, {
      email,
      role: data.role,
    });

    return { ok: true, userId };
  });

const UpdateZ = z.object({
  companyId: z.string().uuid(),
  membershipId: z.string().uuid(),
  role: RoleZ.optional(),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  permissions: PermsZ.optional(),
  active: z.boolean().optional(),
  staffId: z.string().uuid().nullable().optional(),
});

export const updateCompanyUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateZ.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.companyId);
    const patch: Record<string, unknown> = {};
    if (data.role !== undefined) patch.role = data.role;
    if (data.jobTitle !== undefined) patch.job_title = data.jobTitle;
    if (data.permissions !== undefined) patch.permissions = data.permissions;
    if (data.active !== undefined) patch.active = data.active;
    if (data.staffId !== undefined) patch.staff_id = data.staffId;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("company_users")
      .update(patch as any)
      .eq("id", data.membershipId)
      .eq("company_id", data.companyId)
      .select("user_id,role")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Usuário não encontrado nesta empresa.");

    if (data.role) {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", row.user_id)
        .in("role", ["company_admin", "staff", "receptionist"]);
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: row.user_id, role: data.role } as any, { onConflict: "user_id,role" });
    }

    await audit(
      context.supabase,
      data.companyId,
      context.userId,
      "user_updated",
      "company_users",
      data.membershipId,
      patch,
    );
    return { ok: true };
  });

const PasswordZ = z.object({
  companyId: z.string().uuid(),
  membershipId: z.string().uuid(),
  password: z.string().min(8).max(72),
});

export const setCompanyUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PasswordZ.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.companyId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("company_users")
      .select("user_id")
      .eq("id", data.membershipId)
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (!row) throw new Error("Usuário não encontrado nesta empresa.");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    await audit(context.supabase, data.companyId, context.userId, "user_password_reset", "company_users", data.membershipId);
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
    await audit(context.supabase, data.companyId, context.userId, "user_removed", "company_users", data.membershipId);
    return { ok: true };
  });

export const listCompanyUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ companyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.companyId);
    const { data: rows, error } = await context.supabase
      .from("company_users")
      .select("id,user_id,role,created_at,job_title,permissions,active,staff_id")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r: any) => r.user_id);
    if (!ids.length) return [];
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id,full_name")
      .in("id", ids);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emailMap = new Map(usersList?.users?.map((u) => [u.id, u.email]) ?? []);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      role: r.role,
      jobTitle: r.job_title ?? null,
      permissions: (r.permissions ?? {}) as Record<string, boolean>,
      active: r.active !== false,
      staffId: r.staff_id ?? null,
      createdAt: r.created_at,
      fullName: profiles?.find((p: any) => p.id === r.user_id)?.full_name ?? null,
      email: emailMap.get(r.user_id) ?? null,
    }));
  });

// Compatibilidade com telas antigas
export const updateCompanyUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      companyId: z.string().uuid(),
      membershipId: z.string().uuid(),
      role: RoleZ,
    }).parse(input),
  )
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
