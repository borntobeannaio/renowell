GRANT INSERT ON public.projects TO authenticated;

CREATE POLICY "Authenticated users can create projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (true);