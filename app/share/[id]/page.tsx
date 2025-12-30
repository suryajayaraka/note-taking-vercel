"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Note, Tag } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Lock } from "lucide-react"

export default function PublicNotePage() {
  const params = useParams()
  const router = useRouter()
  const noteId = params.id as string
  const [note, setNote] = useState<Note | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const loadNote = async () => {
      setIsLoading(true)
      try {
        // Load note (RLS will check if it's public)
        const { data: noteData, error: noteError } = await supabase
          .from("notes")
          .select("*")
          .eq("id", noteId)
          .eq("is_public", true)
          .single()

        if (noteError || !noteData) {
          setNotFound(true)
          return
        }

        // Load tags for this note
        const { data: tagData, error: tagError } = await supabase
          .from("note_tags")
          .select("tags(*)")
          .eq("note_id", noteId)

        if (tagError) throw tagError

        setNote(noteData)
        setTags(tagData?.map((nt: any) => nt.tags) || [])
      } catch (err) {
        console.error("Failed to load note:", err)
        setNotFound(true)
      } finally {
        setIsLoading(false)
      }
    }

    loadNote()
  }, [noteId, supabase])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (notFound || !note) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Lock className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Note Not Found or Private</h1>
        <p className="text-muted-foreground mb-6 text-center">
          This note doesn't exist or hasn't been shared publicly.
        </p>
        <Button onClick={() => router.push("/login")}>Go to Login</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{note.title || "Untitled Note"}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Shared publicly • Last updated {new Date(note.updated_at).toLocaleDateString()}
              </p>
            </div>
            <Button variant="outline" onClick={() => router.push("/login")}>
              Sign In
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {tags.map((tag) => (
              <Badge key={tag.id} variant="outline">
                #{tag.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Note Content */}
        <div
          className="prose prose-neutral dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: note.content || "<p>No content</p>" }}
        />
      </div>
    </div>
  )
}
