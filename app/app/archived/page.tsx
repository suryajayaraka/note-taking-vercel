"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Note, Tag } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RotateCcw, Trash2, Archive } from "lucide-react"

export default function ArchivedPage() {
  const [notes, setNotes] = useState<(Note & { tags: Tag[] })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadArchivedNotes()
  }, [])

  const loadArchivedNotes = async () => {
    try {
      setIsLoading(true)
      // Load archived notes
      const { data: notesData, error: notesError } = await supabase
        .from("notes")
        .select("*")
        .eq("is_archived", true)
        .order("updated_at", { ascending: false })

      if (notesError) throw notesError

      // Load tags for each note
      const notesWithTags = await Promise.all(
        (notesData || []).map(async (note) => {
          const { data: tagData } = await supabase.from("note_tags").select("tags(*)").eq("note_id", note.id)

          return {
            ...note,
            tags: tagData?.map((nt: any) => nt.tags) || [],
          }
        }),
      )

      setNotes(notesWithTags)
    } catch (err) {
      console.error("Failed to load archived notes:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestoreNote = async (noteId: string) => {
    try {
      const { error } = await supabase.from("notes").update({ is_archived: false }).eq("id", noteId)

      if (error) throw error

      // Remove from local state
      setNotes((prev) => prev.filter((note) => note.id !== noteId))
    } catch (err) {
      console.error("Failed to restore note:", err)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Are you sure you want to permanently delete this note? This action cannot be undone.")) {
      return
    }

    try {
      // Delete note_tags first (foreign key constraint)
      await supabase.from("note_tags").delete().eq("note_id", noteId)

      // Delete the note
      const { error } = await supabase.from("notes").delete().eq("id", noteId)

      if (error) throw error

      // Remove from local state
      setNotes((prev) => prev.filter((note) => note.id !== noteId))
    } catch (err) {
      console.error("Failed to delete note:", err)
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Loading archived notes...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 md:p-8 overflow-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Archive className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl md:text-3xl font-bold">Archived Notes</h1>
        </div>

        {notes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Archive className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No archived notes</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Notes you archive will appear here. You can restore them or delete them permanently.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {notes.map((note) => (
              <Card key={note.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-2 truncate">{note.title}</h3>
                      {note.content && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {note.content.replace(/<[^>]*>/g, "").substring(0, 150)}
                        </p>
                      )}
                      {note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {note.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-secondary text-secondary-foreground"
                            >
                              #{tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Archived {new Date(note.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestoreNote(note.id)}
                        className="flex items-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span className="hidden sm:inline">Restore</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteNote(note.id)}
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Delete</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
