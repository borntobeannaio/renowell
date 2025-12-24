-- Create projects table
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view projects
CREATE POLICY "Authenticated users can view projects"
ON public.projects
FOR SELECT
TO authenticated
USING (true);

-- Create tasks table
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'doing', 'done')),
    labels TEXT[] DEFAULT '{}',
    origin_type TEXT,
    origin_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view tasks
CREATE POLICY "Authenticated users can view tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (true);

-- Allow all authenticated users to insert tasks
CREATE POLICY "Authenticated users can insert tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to update tasks
CREATE POLICY "Authenticated users can update tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (true);

-- Allow all authenticated users to delete tasks
CREATE POLICY "Authenticated users can delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial projects
INSERT INTO public.projects (name) VALUES
('УФА МЕГА'),
('КАПИТАЛ АРОВАНА'),
('ДЗЕНЯНДЕКС ПОЛЬХУАМИН'),
('ВК входная группа'),
('Атриум'),
('ВК Красный мост'),
('ВК Зингер'),
('Аструм 2 проект'),
('SMM/PR'),
('Отдел продаж'),
('Отдел работы с подрядчиками'),
('Тендеры'),
('Подбор персонала'),
('Бизнес процессы');