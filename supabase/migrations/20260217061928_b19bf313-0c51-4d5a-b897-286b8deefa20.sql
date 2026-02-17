
DROP POLICY "Authenticated users can view calendar_events" ON public.calendar_events;

CREATE POLICY "Authenticated users can view calendar_events" 
ON public.calendar_events 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND (
    source != 'external' 
    OR creator_id != '3a1da923-d258-4b32-8cf0-1621ad95ec43'
    OR get_user_profile_id() IN ('3a1da923-d258-4b32-8cf0-1621ad95ec43', 'd169e7ad-6e14-44ed-8cac-3949716b5edf')
  )
);
