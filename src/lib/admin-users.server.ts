import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Procura um usuário do Auth pelo e-mail percorrendo todas as páginas.
 * (listUsers pagina em 200 por vez — sem o loop, contas mais antigas
 * simplesmente não eram encontradas.)
 */
export async function findAuthUserByEmail(email: string) {
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const found = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (found) return found;
    if (users.length < perPage) break;
  }
  return null;
}
