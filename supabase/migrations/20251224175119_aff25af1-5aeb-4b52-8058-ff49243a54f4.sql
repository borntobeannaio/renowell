-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  department TEXT,
  avatar_url TEXT,
  birthday DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- RLS policies - all authenticated users can view employees
CREATE POLICY "Authenticated users can view employees"
ON public.employees
FOR SELECT
TO authenticated
USING (true);

-- Only admins can insert/update/delete (for now allow authenticated users)
CREATE POLICY "Authenticated users can insert employees"
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update employees"
ON public.employees
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete employees"
ON public.employees
FOR DELETE
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();