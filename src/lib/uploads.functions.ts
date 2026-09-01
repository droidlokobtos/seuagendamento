import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IMAGE_PRESETS, dimensionsMatch, presetError, readImageSize, type ImagePresetKey } from "@/lib/image-presets";

/**
 * Validação de dimensões no backend. Recebe o caminho do arquivo já enviado
 * ao bucket, lê os bytes e compara com o preset configurado.
 * Se estiver fora do tamanho, o arquivo é removido e o erro é retornado.
 */
export const validateUploadedImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { path: string; preset: string }) => {
    if (!input?.path || typeof input.path !== "string") throw new Error("Caminho inválido");
    if (!(input.preset in IMAGE_PRESETS)) throw new Error("Preset de imagem inválido");
    return { path: input.path, preset: input.preset as ImagePresetKey };
  })
  .handler(async ({ data, context }) => {
    const preset = IMAGE_PRESETS[data.preset];
    const { data: file, error } = await context.supabase.storage.from("company-assets").download(data.path);
    if (error || !file) return { ok: false as const, error: "Não foi possível validar a imagem enviada." };

    const bytes = new Uint8Array(await file.arrayBuffer());
    const size = readImageSize(bytes);
    if (!size) return { ok: true as const, width: null, height: null };

    if (!dimensionsMatch(preset, size.width, size.height)) {
      await context.supabase.storage.from("company-assets").remove([data.path]);
      return { ok: false as const, error: presetError(preset, size.width, size.height) };
    }
    return { ok: true as const, width: size.width, height: size.height };
  });
