CREATE TABLE public.guide_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'tutorial',
  title text NOT NULL,
  description text,
  storage_path text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.guide_videos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guide_videos TO authenticated;
GRANT ALL ON public.guide_videos TO service_role;

ALTER TABLE public.guide_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guide videos are public" ON public.guide_videos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins insert guide videos" ON public.guide_videos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update guide videos" ON public.guide_videos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete guide videos" ON public.guide_videos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "public read guide video files" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'guide-videos');
CREATE POLICY "admins upload guide video files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'guide-videos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete guide video files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'guide-videos' AND public.has_role(auth.uid(), 'admin'));