import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreativeInput = z.object({
  theme: z.enum(["features", "practicality", "plans", "referral", "custom"]),
  format: z.enum(["square", "story"]),
  style: z.enum(["impact", "editorial", "product", "human"]),
  audience: z.enum(["multi", "salon", "barber", "aesthetic", "wellness"]),
  quality: z.enum(["premium", "fast"]),
  title: z.string().trim().min(3).max(90),
  subtitle: z.string().trim().min(3).max(150),
  direction: z.string().trim().max(500).optional(),
});

const concepts: Record<string, { idea: string; scene: string; details: string }> = {
  features: {
    idea: "From operational chaos to total command",
    scene:
      "a decisive Brazilian business owner at the center of an elegant studio while a visual choreography of calendar blocks, client cards, financial charts and team signals converges into one organized system",
    details:
      "show a clear before-versus-after tension without splitting the image; subtle organized interface geometry, real work tools, momentum and control",
  },
  practicality: {
    idea: "The business keeps moving while management becomes effortless",
    scene:
      "a confident Brazilian service-business owner moving naturally through a real working studio, checking a smartphone once while the team and appointments flow smoothly around them",
    details:
      "authentic candid energy, relaxed authority, time saved made visible through purposeful movement and a clean organized environment",
  },
  plans: {
    idea: "A plan that grows at the exact pace of the business",
    scene:
      "three sculptural stages rising with increasing light and capability, integrated into a sophisticated service-business environment rather than floating generic podiums",
    details:
      "communicate accessible entry, confident progression and unlimited ambition; refined depth, no coins, no price tags, no generic arrows",
  },
  referral: {
    idea: "One trusted recommendation creates a chain of shared growth",
    scene:
      "two distinct Brazilian entrepreneurs in complementary service studios connected by a luminous champagne-gold ribbon that travels through the scene and becomes an elegant growth curve",
    details:
      "warm trust, real partnership and visible mutual benefit; avoid staged handshakes, referral icons, gift boxes and corporate stock-photo clichés",
  },
  custom: {
    idea: "Technology that turns a local service business into a stronger brand",
    scene:
      "an original premium campaign scene where Brazilian entrepreneurship, appointment technology and business growth meet in one memorable visual metaphor",
    details:
      "build one bold focal idea from the custom direction; avoid a generic person merely holding a phone",
  },
};

const styles: Record<string, string> = {
  impact:
    "high-conversion key visual, bold asymmetrical composition, striking foreground scale, decisive diagonal energy, controlled dramatic contrast, visually memorable at thumbnail size",
  editorial:
    "luxury Brazilian editorial campaign, sophisticated art-fashion framing, tactile materials, refined color grading, quiet confidence, unexpected crop and impeccable restraint",
  product:
    "premium product-launch art direction, elegant devices and abstract interface layers as physical design objects, precision lighting, crisp depth, technology made tangible without fake screen text",
  human:
    "authentic cinematic commercial photography, expressive Brazilian entrepreneur in a real working moment, natural gesture and believable environment, aspirational but never staged",
};

const audiences: Record<string, string> = {
  multi:
    "a contemporary Brazilian appointment-based service business, inclusive and not limited to one profession",
  salon:
    "a modern Brazilian hair and beauty salon with authentic professional tools and an ambitious owner",
  barber:
    "a refined contemporary Brazilian barbershop with authentic tools, texture and confident urban character",
  aesthetic:
    "a sophisticated Brazilian aesthetics studio with clean contemporary materials, warmth and professional credibility",
  wellness:
    "an inviting Brazilian wellness and self-care studio with calm premium details and human warmth",
};

export const generateAdminMarketingImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => CreativeInput.parse(value))
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("is_super_admin");
    if (error || !isAdmin) throw new Error("Apenas o Admin Master pode gerar campanhas.");

    const concept = concepts[data.theme];
    const prompt = `Create a genuinely award-worthy advertising key visual for SeuAgendamento, a Brazilian appointment-management SaaS for service businesses.

CAMPAIGN MESSAGE (use only to understand the visual idea; do not render this text):
Headline: "${data.title}"
Support: "${data.subtitle}"

SINGLE BIG IDEA: ${concept.idea}.
HERO SCENE: ${concept.scene}.
STORY DETAILS: ${concept.details}.
TARGET CONTEXT: ${audiences[data.audience]}.
ART-DIRECTION MODE: ${styles[data.style]}.
${data.direction ? `CLIENT'S ADDITIONAL DIRECTION: ${data.direction}.` : ""}

BRAND WORLD: distinctive attainable premium, Brazilian entrepreneurial energy, deep espresso brown #241713, warm ivory #FBF8F3 and restrained champagne gold #C9A86A. Cinematic commercial lighting, realistic materials, intentional shadows, premium color separation, crisp focal subject, subtle depth and meticulous retouching. The result must feel commissioned by a top Brazilian advertising agency, not like an AI template, stock photo, generic corporate technology visual or predictable beauty ad.

LAYOUT: ${data.format === "story" ? "vertical 9:16 story poster; keep the hero action in the upper and middle zones" : "square 1:1 social campaign; keep the hero action above center or on the right"}. Preserve a calm, darkened lower third with enough negative space for a real headline, support line and CTA that will be added later. Strong visual hierarchy and immediate readability at phone size.

NON-NEGOTIABLE: generate background artwork only. No words, letters, numbers, logos, watermarks, price tags, captions, fake UI text, illegible screens, clip-art icons, generic glowing brain, generic handshake, neon cyberpunk, excessive gold, visual clutter, plastic skin, distorted hands or repeated objects.`;
    const { generateLovableImage } = await import("./ai-gateway.server");
    const image = await generateLovableImage({
      prompt,
      size: data.format === "story" ? "1024x1536" : "1024x1024",
      model: data.quality === "premium" ? "openai/gpt-image-2" : "openai/gpt-image-1-mini",
      quality: data.quality === "premium" ? "high" : "medium",
    });
    return { image };
  });
