-- Drop existing policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view note_tags for their notes" ON note_tags;
DROP POLICY IF EXISTS "Users can create note_tags for their notes" ON note_tags;
DROP POLICY IF EXISTS "Users can delete note_tags from their notes" ON note_tags;

-- Create simpler RLS policies that don't cause recursion
-- These policies use joins instead of subqueries to avoid infinite recursion

CREATE POLICY "Users can view note_tags for their notes" ON note_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM notes 
      WHERE notes.id = note_tags.note_id 
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create note_tags for their notes" ON note_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes 
      WHERE notes.id = note_tags.note_id 
      AND notes.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM tags 
      WHERE tags.id = note_tags.tag_id 
      AND tags.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete note_tags from their notes" ON note_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM notes 
      WHERE notes.id = note_tags.note_id 
      AND notes.user_id = auth.uid()
    )
  );
