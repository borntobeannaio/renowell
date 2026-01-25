-- Add birthday and description fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS birthday date,
ADD COLUMN IF NOT EXISTS description text;