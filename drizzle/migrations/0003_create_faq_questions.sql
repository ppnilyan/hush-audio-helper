CREATE TABLE public.faq_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  initials text NOT NULL DEFAULT '??',
  question text NOT NULL,
  answer text,
  status text NOT NULL DEFAULT 'pending',
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX faq_questions_status_idx ON public.faq_questions (status, expires_at DESC);

GRANT SELECT, INSERT ON public.faq_questions TO authenticated;
GRANT UPDATE, DELETE ON public.faq_questions TO authenticated;
GRANT SELECT ON public.faq_questions TO anon;
GRANT ALL ON public.faq_questions TO service_role;

ALTER TABLE public.faq_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "published questions are public"
ON public.faq_questions FOR SELECT TO anon, authenticated
USING (status = 'published' AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "read own questions"
ON public.faq_questions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "insert own questions"
ON public.faq_questions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins read all questions"
ON public.faq_questions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update questions"
ON public.faq_questions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins delete questions"
ON public.faq_questions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));