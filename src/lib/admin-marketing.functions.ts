import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreativeInput = z.object({
  scope: z.enum(["saas", "company"]),
  company_id: z.string().uuid().optional(),
  theme: z.enum([
    "features", "practicality", "plans", "referral", "custom",
    "services", "availability", "promotion", "authority",
  ]),
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
  services: {
    idea: "The quality of the service becomes a desirable visual experience",
    scene:
      "an authentic premium service moment with precise professional technique, tactile materials and a confident client reaction, composed as a memorable Brazilian brand campaign",
    details:
      "make the expertise, care and final experience tangible; avoid generic posing and obvious before-and-after splits",
  },
  availability: {
    idea: "The perfect moment of care is within easy reach",
    scene:
      "a cinematic service-business environment prepared for the next client, with one inviting focal point, subtle sense of timing and elegant anticipation",
    details:
      "communicate convenience and desire without calendars, clocks, floating interface cards or literal booking icons",
  },
  promotion: {
    idea: "A special opportunity presented with value, not cheapness",
    scene:
      "a highly desirable hero service or result staged with editorial confidence, bold controlled lighting and a refined visual reveal",
    details:
      "create urgency through composition and contrast; no price tags, sale stickers, percent signs, confetti or retail clichés",
  },
  authority: {
    idea: "Professional mastery that earns trust before a word is spoken",
    scene:
      "a confident Brazilian specialist in a real working moment, framed with cinematic credibility, precise tools and an unmistakable signature atmosphere",
    details:
      "show expertise through action and detail rather than crossed arms, certificates, handshakes or stock-photo smiles",
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
    const { data: isAdmin, error: adminError } = await context.supabase.rpc("is_super_admin");
    if (adminError) throw new Error("Não foi possível validar o acesso ao estúdio.");

    let brandName = "SeuAgendamento";
    let brandWorld =
      "distinctive attainable premium, Brazilian entrepreneurial energy, deep espresso brown #241713, warm ivory #FBF8F3 and restrained champagne gold #C9A86A";
    let targetContext = audiences[data.audience];

    if (data.scope === "saas") {
      if (!isAdmin) throw new Error("Apenas o Admin Master pode gerar campanhas do SaaS.");
    } else {
      if (!data.company_id) throw new Error("Selecione uma empresa para criar a campanha.");
      const [{ data: company, error: companyError }, { data: membership }] = await Promise.all([
        context.supabase
          .from("companies")
          .select("id,name,niche_id,plan_code,primary_color,secondary_color,status")
          .eq("id", data.company_id)
          .maybeSingle(),
        context.supabase
          .from("company_users")
          .select("id")
          .eq("company_id", data.company_id)
          .eq("user_id", context.userId)
          .eq("active", true)
          .maybeSingle(),
      ]);
      if (companyError || !company) throw new Error("Empresa não encontrada ou sem acesso.");
      if (!isAdmin && !membership) throw new Error("Você não tem acesso a esta empresa.");
      if (company.plan_code?.trim().toLowerCase() !== "pro") {
        throw new Error("O estúdio de marketing com IA é exclusivo do plano Pro.");
      }
      if (["suspended", "overdue", "trial_expired"].includes(company.status ?? "")) {
        throw new Error("A empresa precisa estar ativa para gerar campanhas.");
      }
      brandName = company.name;
      brandWorld = `the authentic identity of ${company.name}, led by primary color ${company.primary_color ?? "#241713"} and accent color ${company.secondary_color ?? "#C9A86A"}, applied with premium restraint and consistent color grading`;
      if (company.niche_id) {
        const { data: niche } = await context.supabase
          .from("niches")
          .select("name")
          .eq("id", company.niche_id)
          .maybeSingle();
        if (niche?.name) targetContext = `${niche.name}, a Brazilian appointment-based service business`;
      }
    }

    const concept = concepts[data.theme];
    const prompt = `Create a genuinely award-worthy advertising key visual for ${brandName}, ${data.scope === "saas" ? "a Brazilian appointment-management SaaS for service businesses" : "a Brazilian service business advertising directly to its customers"}.

CAMPAIGN MESSAGE (use only to understand the visual idea; do not render this text):
Headline: "${data.title}"
Support: "${data.subtitle}"

SINGLE BIG IDEA: ${concept.idea}.
HERO SCENE: ${concept.scene}.
STORY DETAILS: ${concept.details}.
TARGET CONTEXT: ${targetContext}.
ART-DIRECTION MODE: ${styles[data.style]}.
${data.direction ? `CLIENT'S ADDITIONAL DIRECTION: ${data.direction}.` : ""}

BRAND WORLD: ${brandWorld}. Cinematic commercial lighting, realistic materials, intentional shadows, premium color separation, crisp focal subject, subtle depth and meticulous retouching. The result must feel commissioned by a top Brazilian advertising agency, not like an AI template, stock photo, generic corporate technology visual or predictable beauty ad.

LAYOUT: ${data.format === "story" ? "vertical 9:16 story poster; keep the hero action in the upper and middle zones" : "square 1:1 social campaign; keep the hero action above center or on the right"}. Preserve a calm, darkened lower third with enough negative space for a real headline, support line and CTA that will be added later. Strong visual hierarchy and immediate readability at phone size.

NON-NEGOTIABLE: generate background artwork only. No words, letters, numbers, logos, watermarks, price tags, captions, fake UI text, illegible screens, clip-art icons, generic glowing brain, generic handshake, neon cyberpunk, excessive gold, visual clutter, plastic skin, distorted hands or repeated objects.`;
    const { generateLovableImage } = await import("./ai-gateway.server");
    const image = await generateLovableImage({
      prompt,
      size: data.format === "story" ? "1024x1536" : "1024x1024",
      model: data.quality === "premium" ? "openai/gpt-image-2" : "openai/gpt-image-1-mini",
      quality: "medium",
    });
    return { image };
  });
