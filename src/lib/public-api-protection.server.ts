import { createHash, randomBytes } from "node:crypto";

type AdminClient = {
  rpc: (name: any, args?: any) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from: (table: any) => any;
};


type GuardOptions = { scope: string; limit: number; windowSeconds: number };

export function requestFingerprint(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const agent = request.headers.get("user-agent")?.slice(0, 160) ?? "unknown";
  return createHash("sha256").update(`${ip}|${agent}`).digest("hex");
}

export async function guardPublicRequest(
  admin: AdminClient,
  request: Request,
  options: GuardOptions,
) {
  const identifierHash = requestFingerprint(request);
  const { data, error } = await admin.rpc("consume_public_rate_limit", {
    _scope: options.scope,
    _identifier_hash: identifierHash,
    _limit: options.limit,
    _window_seconds: options.windowSeconds,
  });
  if (error) throw new Error(`Rate limit unavailable: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as {
    allowed?: boolean;
    remaining?: number;
    retry_after_seconds?: number;
  } | null;
  const allowed = row?.allowed === true;
  await admin.from("public_api_events").insert({
    scope: options.scope,
    identifier_hash: identifierHash,
    outcome: allowed ? "allowed" : "blocked",
    status_code: allowed ? 200 : 429,
  });
  return {
    allowed,
    identifierHash,
    remaining: Math.max(0, Number(row?.remaining ?? 0)),
    retryAfter: Math.max(1, Number(row?.retry_after_seconds ?? options.windowSeconds)),
  };
}

export function rateLimitResponse(retryAfter: number) {
  return Response.json(
    { error: "Muitas tentativas. Aguarde um momento e tente novamente." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export function hashPublicValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function newVerificationToken() {
  return randomBytes(32).toString("base64url");
}
