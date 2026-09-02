import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreativeInput = z.object({
  theme: z.enum(["features", "practicality", "plans", "referral", "custom"]),
  format: z.enum(["square", "story"]),
  direction: z.string().trim().max(500).optional(),
});

const subjects: Record<string, string> = {
  features:
    "an elegant appointment management dashboard represented through refined abstract interface layers, calendar rhythm and organized business data",
  practicality:
    "a confident Brazilian beauty business owner using a modern scheduling platform on smartphone and laptop in a sophisticated studio",
  plans:
    "three ascending premium service tiers represented by elegant architectural platforms and subtle gold light",
  referral:
    "two successful business owners connecting through a refined golden link motif, partnership and shared growth",
  custom: "a sophisticated digital business growth concept for an appointment management SaaS",
};

export const generateAdminMarketingImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => CreativeInput.parse(value))
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("is_super_admin");
    if (error || !isAdmin) throw new Error("Apenas o Admin Master pode gerar campanhas.");

    const prompt = `Create a world-class premium advertising background for a Brazilian SaaS named SeuAgendamento. Subject: ${subjects[data.theme]}. ${data.direction ? `Creative direction: ${data.direction}.` : ""} Brand language: modern luxury, editorial commercial photography, deep espresso brown #241713, warm ivory #FBF8F3, restrained champagne gold #C9A86A, cinematic soft light, impeccable art direction, spacious composition, trustworthy technology, subtle depth, sophisticated beauty and wellness business atmosphere. Reserve a clean dark or softly blurred area on the left/lower third for later typography overlay. No words, no letters, no logos, no watermarks, no fake interface text, no clutter, no neon colors. Professional social media campaign quality. ${data.format === "story" ? "Vertical 9:16 composition." : "Square 1:1 composition."}`;
    const { generateLovableImage } = await import("./ai-gateway.server");
    const image = await generateLovableImage({
      prompt,
      size: data.format === "story" ? "1024x1536" : "1024x1024",
    });
    return { image };
  });
