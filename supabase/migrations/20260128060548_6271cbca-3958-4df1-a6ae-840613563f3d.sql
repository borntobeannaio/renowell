-- Add UPDATE policy for protocol_item_comments
CREATE POLICY "Authors can update own protocol item comments" 
  ON protocol_item_comments 
  FOR UPDATE 
  USING (author_id = get_user_profile_id())
  WITH CHECK (author_id = get_user_profile_id());