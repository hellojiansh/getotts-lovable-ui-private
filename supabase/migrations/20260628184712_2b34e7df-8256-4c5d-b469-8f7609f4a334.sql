
-- Indexes for the dashboard's hot queries
CREATE INDEX IF NOT EXISTS perf_vitals_created_at_idx
  ON public.perf_vitals (created_at DESC);
CREATE INDEX IF NOT EXISTS perf_vitals_page_created_at_idx
  ON public.perf_vitals (page, created_at DESC);

-- Retention: keep only the last 30 days
CREATE OR REPLACE FUNCTION public.prune_perf_vitals()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.perf_vitals WHERE created_at < now() - INTERVAL '30 days';
$$;

REVOKE ALL ON FUNCTION public.prune_perf_vitals() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_perf_vitals() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Replace any existing schedule with the same name
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-perf-vitals-daily') THEN
    PERFORM cron.unschedule('prune-perf-vitals-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'prune-perf-vitals-daily',
  '17 3 * * *',
  $$ SELECT public.prune_perf_vitals(); $$
);
