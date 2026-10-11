CREATE TABLE public.console_user_data (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.console_user_data TO authenticated;
GRANT ALL ON public.console_user_data TO service_role;
ALTER TABLE public.console_user_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.console_user_data FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.console_user_data FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.console_user_data FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.console_user_data FOR DELETE TO authenticated USING (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.console_projects TO authenticated;
GRANT ALL ON public.console_projects TO service_role;