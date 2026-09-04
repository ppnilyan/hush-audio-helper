CREATE TABLE public.generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  credits integer NOT NULL DEFAULT 10,
  from_monthly integer NOT NULL DEFAULT 0,
  from_purchased integer NOT NULL DEFAULT 0,
  history_count_before integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  settled_at timestamp with time zone
);

CREATE INDEX generation_jobs_user_created_idx ON public.generation_jobs (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.generation_jobs TO authenticated;
GRANT ALL ON public.generation_jobs TO service_role;

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own generation jobs read" ON public.generation_jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "own generation jobs insert" ON public.generation_jobs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own generation jobs update" ON public.generation_jobs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);