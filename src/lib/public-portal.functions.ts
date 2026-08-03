import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Colunas de vitrine expostas publicamente (view public_companies).
const PUBLIC_COMPANY_COLUMNS =
  "id,niche_id,sub_niche_id,name,slug,logo_url,banner_url,app_icon_url,primary_color,secondary_color,theme,address,city,state,latitude,longitude,phone,whatsapp,status,listed_in_marketplace,short_description,description,welcome_message,instagram_url,facebook_url,tiktok_url,website_url,show_staff_on_portal,show_reviews_on_portal,amenities,online_booking_enabled,min_advance_min,max_advance_days,buffer_min,deposit_enabled,deposit_type,deposit_value,portal_bg_url,portal_bg_style,portal_button_color,portal_text_color,portal_card_style,portal_highlight,portal_slogan";

export type PublicCompany = Record<string, any>;

/** Dados de vitrine de uma empresa pelo slug (sem PIX, documento, e-mail ou dados de cobrança). */
export const getPublicCompany = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const { publicSupabase } = await import("./public-portal.server");
    const { data: company, error } = await publicSupabase()
      .from("public_companies")
      .select(PUBLIC_COMPANY_COLUMNS)
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (company ?? null) as PublicCompany | null;
  });

/** Empresas listadas no marketplace. */
export const listPublicCompanies = createServerFn({ method: "GET" }).handler(async () => {
  const { publicSupabase } = await import("./public-portal.server");
  const { data } = await publicSupabase()
    .from("public_companies")
    .select("id,name,slug,logo_url,primary_color,short_description,city,state,niche_id")
    .eq("listed_in_marketplace", true)
    .order("name");
  return (data ?? []) as PublicCompany[];
});

/** Bloqueios de agenda (apenas janelas de horário, sem o motivo). */
export const getPublicTimeBlocks = createServerFn({ method: "GET" })
  .inputValidator((input: { companyId: string; from: string; to: string }) =>
    z
      .object({ companyId: z.string().uuid(), from: z.string().min(1), to: z.string().min(1) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { publicSupabase } = await import("./public-portal.server");
    const { data: blocks } = await publicSupabase()
      .from("public_time_blocks")
      .select("starts_at,ends_at,staff_id")
      .eq("company_id", data.companyId)
      .lt("starts_at", data.to)
      .gt("ends_at", data.from);
    return (blocks ?? []) as { starts_at: string; ends_at: string; staff_id: string | null }[];
  });
