-- Add is_public column to notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- Create index for public notes
CREATE INDEX IF NOT EXISTS idx_notes_is_public ON notes(is_public) WHERE is_public = TRUE;

-- Add RLS policy for public read access to shared notes
CREATE POLICY "Anyone can view public notes" ON notes
  FOR SELECT USING (is_public = TRUE);

-- Add RLS policy for public read access to tags of public notes
CREATE POLICY "Anyone can view tags of public notes" ON note_tags
  FOR SELECT USING (
    note_id IN (SELECT id FROM notes WHERE is_public = TRUE)
  );

CREATE POLICY "Anyone can view tags referenced by public notes" ON tags
  FOR SELECT USING (
    id IN (
      SELECT tag_id FROM note_tags 
      WHERE note_id IN (SELECT id FROM notes WHERE is_public = TRUE)
    )
  );
