import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AlertSchema = z.object({
  id: z.string().min(1).max(80),
  severity: z.enum(["critical", "attention", "opportunity", "positive"]),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1200),
  metric: z.string().max(120).optional().nullable(),
  action: z.string().min(1).max(500),
});

const SyncInput = z.object({
  company_id: z.string().uuid(),
  alerts: z.array(AlertSchema).max(20),
});

const CompanyInput = z.object({ company_id: z.string().uuid() });

function changed(existing: any, alert: z.infer<typeof AlertSchema>) {
  return existing.severity !== alert.severity ||
    existing.description !== alert.description ||
    (existing.metric ?? null) !== (alert.metric ?? null) ||
    existing.action !== alert.action;
}

export const syncAiAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SyncInput.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const now = new Date();
    const nowIso = now.toISOString();
    const keys = data.alerts.map(a => a.id);

    const { data: existingRows, error: existingError } = await db
      .from("ai_alerts")
      .select("*")
      .eq("company_id", data.company_id);
    if (existingError) throw existingError;

    const existingByKey = new Map((existingRows ?? []).map((row: any) => [row.alert_key, row]));
    const events: any[] = [];

    for (const alert of data.alerts) {
      const existing: any = existingByKey.get(alert.id);
      if (!existing) {
        const { data: inserted, error } = await db.from("ai_alerts").insert({
          company_id: data.company_id,
          alert_key: alert.id,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          metric: alert.metric ?? null,
          action: alert.action,
          status: "active",
          first_seen_at: nowIso,
          last_seen_at: nowIso,
          last_event_at: nowIso,
          updated_at: nowIso,
        }).select("id").single();
        if (error) throw error;
        events.push({ company_id: data.company_id, alert_id: inserted.id, alert_key: alert.id, event_type: "opened", severity: alert.severity, title: alert.title, description: alert.description, metric: alert.metric ?? null, action: alert.action, snapshot: alert });
        continue;
      }

      const isReopen = existing.status === "resolved";
      const isChanged = changed(existing, alert);
      const hoursSinceEvent = (now.getTime() - new Date(existing.last_event_at ?? existing.last_seen_at).getTime()) / 36e5;
      const shouldLogUpdate = !isReopen && isChanged && hoursSinceEvent >= 1;
      const shouldCountOccurrence = isReopen || isChanged || hoursSinceEvent >= 6;

      const { error } = await db.from("ai_alerts").update({
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        metric: alert.metric ?? null,
        action: alert.action,
        status: "active",
        last_seen_at: nowIso,
        resolved_at: null,
        reopened_count: existing.reopened_count + (isReopen ? 1 : 0),
        occurrence_count: existing.occurrence_count + (shouldCountOccurrence ? 1 : 0),
        last_event_at: (isReopen || shouldLogUpdate) ? nowIso : existing.last_event_at,
        updated_at: nowIso,
      }).eq("id", existing.id);
      if (error) throw error;

      if (isReopen || shouldLogUpdate) {
        events.push({ company_id: data.company_id, alert_id: existing.id, alert_key: alert.id, event_type: isReopen ? "reopened" : "updated", severity: alert.severity, title: alert.title, description: alert.description, metric: alert.metric ?? null, action: alert.action, snapshot: { ...alert, previous_metric: existing.metric, previous_severity: existing.severity } });
      }
    }

    for (const existing of existingRows ?? []) {
      if (existing.status !== "active" || keys.includes(existing.alert_key)) continue;
      const { error } = await db.from("ai_alerts").update({ status: "resolved", resolved_at: nowIso, last_event_at: nowIso, updated_at: nowIso }).eq("id", existing.id);
      if (error) throw error;
      events.push({ company_id: data.company_id, alert_id: existing.id, alert_key: existing.alert_key, event_type: "resolved", severity: existing.severity, title: existing.title, description: existing.description, metric: existing.metric, action: existing.action, snapshot: { resolved_automatically: true } });
    }

    if (events.length) {
      const { error } = await db.from("ai_alert_events").insert(events);
      if (error) throw error;
    }

    return { synced: data.alerts.length, events_created: events.length };
  });

export const getAiAlertHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CompanyInput.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const [alertsRes, eventsRes] = await Promise.all([
      db.from("ai_alerts").select("*").eq("company_id", data.company_id).order("last_seen_at", { ascending: false }).limit(100),
      db.from("ai_alert_events").select("*").eq("company_id", data.company_id).order("created_at", { ascending: false }).limit(120),
    ]);
    if (alertsRes.error) throw alertsRes.error;
    if (eventsRes.error) throw eventsRes.error;

    const alerts = alertsRes.data ?? [];
    return {
      active: alerts.filter((a: any) => a.status === "active"),
      resolved: alerts.filter((a: any) => a.status === "resolved"),
      events: eventsRes.data ?? [],
      summary: {
        active_count: alerts.filter((a: any) => a.status === "active").length,
        resolved_count: alerts.filter((a: any) => a.status === "resolved").length,
        reopened_count: alerts.reduce((sum: number, a: any) => sum + Number(a.reopened_count ?? 0), 0),
      },
    };
  });
