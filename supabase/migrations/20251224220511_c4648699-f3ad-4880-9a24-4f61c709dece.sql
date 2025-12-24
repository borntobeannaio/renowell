-- Добавляем колонку profile_id в employees для связи с profiles
ALTER TABLE public.employees 
ADD COLUMN profile_id uuid REFERENCES public.profiles(id);

-- Связываем существующих сотрудников с профилями по совпадению имени
-- Асташкина Ольга
UPDATE public.employees 
SET profile_id = '425053eb-4346-47d1-a67b-29f66cc7494e'
WHERE id = '5298e1b7-22ba-4869-ab0b-02a01bb3bc32';

-- Нечаева Софья
UPDATE public.employees 
SET profile_id = 'd169e7ad-6e14-44ed-8cac-3949716b5edf'
WHERE id = '5e4ee307-59ca-47b4-b6b4-270fcaca1711';