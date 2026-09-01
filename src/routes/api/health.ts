import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const configuredSecret = process.env.HEALTH_CHECK_SECRET;
        const suppliedSecret = request.headers.get("x-health-check-secret");
        if (!configuredSecret || suppliedSecret !== configuredSecret) {
          return Response.json({ ok: false }, { status: 404 });
        }
        const started = Date.now();
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.rpc("system_health_snapshot");
          if (error) throw error;
          const checks = data as Record<string, boolean>;
          const healthy = [
            checks.database,
            checks.rate_limit_table,
            checks.observability_table,
            checks.verification_table,
            checks.overlap_trigger,
          ].every(Boolean);
          return Response.json(
            { ok: healthy, checks, duration_ms: Date.now() - started },
            { status: healthy ? 200 : 503 },
          );
        } catch {
          return Response.json(
            { ok: false, error: "health_check_failed", duration_ms: Date.now() - started },
            { status: 503 },
          );
        }
      },
    },
  },
});
