export interface Note {
  id: string
  user_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
  is_archived: boolean
  tags?: Tag[]
}

export interface Tag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface NoteTag {
  id: string
  note_id: string
  tag_id: string
  created_at: string
}

export interface NoteWithTags extends Note {
  tags: Tag[]
}
