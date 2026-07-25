CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('review-invites-dispatch')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'review-invites-dispatch');

SELECT cron.schedule(
  'review-invites-dispatch',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://seuagendamento.lovable.app/api/public/hooks/review-invites',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnZXdyY2JpcWZucG1semd3cXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyOTM3MDksImV4cCI6MjA5OTg2OTcwOX0.HGMbq4yc3exCxrM2F-H3pphAy3yJTQBaL1H6wWVnQlU"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);