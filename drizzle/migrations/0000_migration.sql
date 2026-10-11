CREATE TABLE public.console_projects (
  id text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.console_projects TO authenticated;
GRANT ALL ON public.console_projects TO service_role;
ALTER TABLE public.console_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.console_projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.console_projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.console_projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.console_projects FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX console_projects_user_idx ON public.console_projects(user_id);