import { createClient } from "@supabase/supabase-js";

export async function createUserWithPublicSignup(input: {
  email: string;
  password: string;
  fullName: string;
}) {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("Lovable Cloud não está conectado corretamente.");
  }

  const client = createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storage: undefined,
    },
  });

  const { data, error } = await client.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.fullName } },
  });
  if (error) {
    if (/weak|easy to guess|pwned|compromis/i.test(error.message)) {
      throw new Error(
        "Senha muito fraca ou já vazada em outros sites. Use uma senha forte (8+ caracteres, com letras, números e símbolos).",
      );
    }
    throw new Error(error.message);
  }

  if (!data.user) throw new Error("Não foi possível criar o usuário da empresa.");

  // Supabase can return an obfuscated user for an existing account.
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error("Este e-mail já possui uma conta. Use outro e-mail ou vincule a empresa pelo cadastro existente.");
  }

  return {
    userId: data.user.id,
    emailConfirmed: !!data.user.email_confirmed_at,
    hasSession: !!data.session,
  };
}
