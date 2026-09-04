import { timingSafeEqual } from "node:crypto";

type AutomationResult = {
  processed: number;
  skipped?: number;
  failed?: number;
  [key: string]: unknown;
};

type AutomationContext = {
  admin: any;
  origin: string;
  runId: string;
};

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function cleanOrigin(value: string) {
  const parsed = new URL(value);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("automation_base_url_invalid");
  return parsed.origin;
}

/**
 * Executa um job interno com autenticação, trava contra sobreposição e auditoria.
 * A URL pública e o segredo ficam centralizados em automation_runtime_config.
 */
export async function runAutomationJob(
  request: Request,
  jobName: string,
  handler: (context: AutomationContext) => Promise<AutomationResult>,
) {
  const startedAt = Date.now();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;

  const suppliedSecret = request.headers.get("x-automation-secret") ?? "";
  const { data: config, error: configError } = await admin
    .from("automation_runtime_config")
    .select("base_url,hook_secret,enabled")
    .eq("id", true)
    .maybeSingle();

  if (configError || !config || config.enabled !== true) {
    return Response.json(
      { ok: false, error: "automation_not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!suppliedSecret || !safeEqual(suppliedSecret, config.hook_secret)) {
    return Response.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const requestId = request.headers.get("x-request-id")?.slice(0, 100) || crypto.randomUUID();
  const { data: runId, error: startError } = await admin.rpc("try_start_automation_run", {
    _job_name: jobName,
    _request_id: requestId,
  });

  if (startError) {
    return Response.json(
      { ok: false, error: "automation_start_failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!runId) {
    return Response.json(
      { ok: true, skipped: true, reason: "already_running" },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await handler({ admin, origin: cleanOrigin(config.base_url), runId });
    await admin.rpc("finish_automation_run", {
      _run_id: runId,
      _status: "success",
      _processed_count: result.processed ?? 0,
      _skipped_count: result.skipped ?? 0,
      _failed_count: result.failed ?? 0,
      _error_message: null,
    });
    return Response.json(
      { ok: true, ...result, duration_ms: Date.now() - startedAt },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "automation_failed";
    await admin.rpc("finish_automation_run", {
      _run_id: runId,
      _status: "failed",
      _processed_count: 0,
      _skipped_count: 0,
      _failed_count: 1,
      _error_message: message,
    });
    console.error(`[Automation:${jobName}] ${message}`);
    return Response.json(
      { ok: false, error: "automation_failed", request_id: requestId },
      {
        status: 500,
        headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
      },
    );
  }
}
