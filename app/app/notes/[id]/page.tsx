"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Note, Tag } from "@/lib/types"
import { NoteEditor } from "@/components/note-editor"

export default function NotePage() {
  const params = useParams()
  const noteId = params.id as string
  const [note, setNote] = useState<Note | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    console.log("[v0] NotePage: Loading note:", noteId)
    const loadNote = async () => {
      setIsLoading(true)
      try {
        // Load note
        const { data: noteData, error: noteError } = await supabase.from("notes").select("*").eq("id", noteId).single()

        if (noteError) throw noteError

        // Load tags for this note
        const { data: tagData, error: tagError } = await supabase
          .from("note_tags")
          .select("tags(*)")
          .eq("note_id", noteId)

        if (tagError) throw tagError

        setNote(noteData)
        setTags(tagData?.map((nt: any) => nt.tags) || [])
        console.log("[v0] NotePage: Note loaded successfully")
      } catch (err) {
        console.error("Failed to load note:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadNote()
  }, [noteId, supabase])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!note) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Note not found</p>
      </div>
    )
  }

  return <NoteEditor note={note} tags={tags} onNoteUpdate={setNote} onTagsUpdate={setTags} />
}
