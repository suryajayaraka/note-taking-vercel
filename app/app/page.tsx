"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Note, Tag } from "@/lib/types"
import { TagGraph } from "@/components/tag-graph"

export default function DashboardPage() {
  const [notes, setNotes] = useState<(Note & { tags: Tag[] })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const loadNotesWithTags = async () => {
      try {
        // Load notes
        const { data: notesData, error: notesError } = await supabase
          .from("notes")
          .select("*")
          .eq("is_archived", false)
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
        console.error("Failed to load notes:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadNotesWithTags()
  }, [supabase])

  const handleCreateNote = async () => {
    try {
      const { data, error } = await supabase
        .from("notes")
        .insert({
          title: "Untitled Note",
          content: "",
          user_id: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()

      if (error) throw error
      router.push(`/app/notes/${data[0].id}`)
    } catch (err) {
      console.error("Failed to create note:", err)
    }
  }

  return (
    <div className="flex-1 p-4 md:p-8 overflow-auto bg-gradient-to-br from-background to-background/95">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
          <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent mb-2">
            Tag Network
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mb-4">
            Visualize how your tags are connected. Each node represents a tag, and lines connect tags that appear
            together in notes.
          </p>
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <TagGraph
              notes={notes}
              onNodeClick={(tagName) => router.push(`/app/tags/${encodeURIComponent(tagName)}`)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
