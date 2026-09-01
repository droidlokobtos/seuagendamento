import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ company_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error: adminError } = await context.supabase.rpc("is_super_admin");
    if (adminError) throw new Error(adminError.message);
    if (!isAdmin) throw new Error("Apenas Admin Master pode excluir empresas.");

    const { data: result, error } = await (context.supabase as any).rpc(
      "delete_company_as_super_admin",
      { _company: data.company_id },
    );

    if (error) throw new Error(error.message);
    return result ?? { ok: true };
  });
