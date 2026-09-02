// Server-only helper: raw fetch to Lovable AI Gateway.
// Kept minimal (no AI SDK) to avoid pulling extra deps.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function callLovableAI(opts: {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
}): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY não configurada");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: opts.model ?? "openai/gpt-5.5",
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Muitas requisições — tente novamente em instantes.");
    if (res.status === 402)
      throw new Error("Créditos da IA esgotados. Adicione créditos no workspace.");
    throw new Error(`Falha na IA (${res.status}): ${body}`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

export async function generateLovableImage(opts: {
  prompt: string;
  size?: "1024x1024" | "1024x1536";
}): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("IA da Lovable não está disponível neste projeto.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);
  let res: Response;
  try {
    res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: "openai/gpt-image-1-mini",
        prompt: opts.prompt,
        size: opts.size ?? "1024x1024",
        quality: "medium",
        output_format: "png",
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("A geração excedeu 75 segundos. Tente novamente.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Limite de gerações atingido. Aguarde um instante.");
    if (res.status === 402) throw new Error("Créditos da IA Lovable esgotados.");
    throw new Error(`Não foi possível gerar a arte (${res.status}): ${body.slice(0, 240)}`);
  }

  const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const image = json.data?.[0];
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`;
  if (image?.url) return image.url;
  throw new Error("A IA não retornou uma imagem válida.");
}
