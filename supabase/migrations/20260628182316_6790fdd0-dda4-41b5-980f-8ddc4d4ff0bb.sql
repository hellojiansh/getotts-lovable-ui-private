
CREATE TABLE public.perf_vitals (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  page TEXT NOT NULL,
  fcp INTEGER,
  lcp INTEGER,
  cls NUMERIC(6,4),
  ttfb INTEGER,
  css_ready INTEGER,
  dom_ready INTEGER,
  load_ms INTEGER,
  fouc BOOLEAN NOT NULL DEFAULT false,
  viewport TEXT,
  dpr NUMERIC(4,2),
  ua TEXT,
  lcp_el TEXT,
  cls_sources JSONB
);

CREATE INDEX perf_vitals_created_at_idx ON public.perf_vitals (created_at DESC);
CREATE INDEX perf_vitals_page_idx ON public.perf_vitals (page, created_at DESC);

GRANT INSERT ON public.perf_vitals TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.perf_vitals_id_seq TO anon, authenticated;
GRANT SELECT ON public.perf_vitals TO authenticated;
GRANT ALL ON public.perf_vitals TO service_role;

ALTER TABLE public.perf_vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit perf vitals"
ON public.perf_vitals FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins read perf vitals"
ON public.perf_vitals FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
