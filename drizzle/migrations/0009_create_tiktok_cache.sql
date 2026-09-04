CREATE TABLE public.tiktok_cache (
  url_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.tiktok_cache TO service_role;

ALTER TABLE public.tiktok_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX tiktok_cache_fetched_at_idx ON public.tiktok_cache (fetched_at);