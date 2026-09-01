import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Colunas de vitrine expostas publicamente (view public_companies).
const PUBLIC_COMPANY_COLUMNS =
  "id,niche_id,sub_niche_id,name,slug,logo_url,banner_url,app_icon_url,primary_color,secondary_color,theme,address,city,state,latitude,longitude,phone,whatsapp,status,listed_in_marketplace,short_description,description,welcome_message,instagram_url,facebook_url,tiktok_url,website_url,show_staff_on_portal,show_reviews_on_portal,amenities,online_booking_enabled,min_advance_min,max_advance_days,buffer_min,booking_slot_interval_min,deposit_enabled,deposit_type,deposit_value,portal_bg_url,portal_bg_style,portal_button_color,portal_text_color,portal_card_style,portal_highlight,portal_slogan";

export type PublicCompany = Record<string, any>;
export type PublicSubscriptionPlan = {
  code: string;
  name: string;
  description: string | null;
  monthly_cents: number;
  cycle_months: number | null;
  cycle_total_cents: number | null;
  discount_percent: number | null;
  max_users: number | null;
  sort_order: number;
};

const FALLBACK_PUBLIC_PLANS: PublicSubscriptionPlan[] = [
  {
    code: "basic",
    name: "Básico",
    description: "Recursos essenciais para começar",
    monthly_cents: 4990,
    cycle_months: 1,
    cycle_total_cents: 4990,
    discount_percent: 0,
    max_users: 3,
    sort_order: 1,
  },
  {
    code: "business",
    name: "Business",
    description: "Gestão completa do salão",
    monthly_cents: 6990,
    cycle_months: 6,
    cycle_total_cents: 39843,
    discount_percent: 5,
    max_users: null,
    sort_order: 2,
  },
  {
    code: "pro",
    name: "Pro",
    description: "Todos os recursos atuais e futuros",
    monthly_cents: 10990,
    cycle_months: 12,
    cycle_total_cents: 125286,
    discount_percent: 5,
    max_users: null,
    sort_order: 3,
  },
];

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

/**
 * Planos comerciais ativos exibidos na página inicial.
 * Tenta carregar do catálogo real. Se o ambiente público não tiver a credencial
 * de servidor disponível, a home continua funcionando com o catálogo padrão.
 */
export const listPublicSubscriptionPlans = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("subscription_plans")
      .select("code,name,description,monthly_cents,cycle_months,cycle_total_cents,discount_percent,max_users,sort_order")
      .eq("active", true)
      .eq("selectable", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn("[landing] Falha ao carregar subscription_plans; usando fallback:", error.message);
      return FALLBACK_PUBLIC_PLANS;
    }

    const plans = (data ?? []) as PublicSubscriptionPlan[];
    return plans.length ? plans : FALLBACK_PUBLIC_PLANS;
  } catch (error) {
    console.warn("[landing] Catálogo de planos indisponível; usando fallback:", error);
    return FALLBACK_PUBLIC_PLANS;
  }
});

/** Intervalos ocupados, sem expor dados do cliente. */
export const getPublicOccupiedAppointments = createServerFn({ method: "GET" })
  .inputValidator((input: { companyId: string; from: string; to: string }) => z.object({ companyId: z.string().uuid(), from: z.string().min(1), to: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("appointments").select("starts_at,ends_at").eq("company_id", data.companyId).not("status", "in", '(cancelled,cancelled_by_customer,cancelled_by_company,no_show)').lt("starts_at", data.to).gt("ends_at", data.from);
    if (error) throw new Error(error.message);
    return (rows ?? []) as { starts_at: string; ends_at: string }[];
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
