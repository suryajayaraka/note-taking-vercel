'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Note, Tag } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function TagPage() {
  const params = useParams()
  const tagName = decodeURIComponent(params.tag as string)
  const [notes, setNotes] = useState<Note[]>([])
  const [tag, setTag] = useState<Tag | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const loadNotesForTag = async () => {
      try {
        // Find tag by name
        const { data: tagData, error: tagError } = await supabase
          .from('tags')
          .select('*')
          .eq('name', tagName)
          .single()

        if (tagError) throw tagError

        setTag(tagData)

        // Get all notes with this tag
        const { data: noteTagData, error: noteTagError } = await supabase
          .from('note_tags')
          .select('notes(*)')
          .eq('tag_id', tagData.id)

        if (noteTagError) throw noteTagError

        const notesData = noteTagData?.map((nt: any) => nt.notes) || []
        setNotes(notesData)
      } catch (err) {
        console.error('Failed to load notes for tag:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadNotesForTag()
  }, [tagName, supabase])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-8">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <h1 className="text-4xl font-bold text-foreground mb-2">
          #{tagName}
        </h1>
        <p className="text-muted-foreground">
          {notes.length} note{notes.length !== 1 ? 's' : ''} with this tag
        </p>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="text-center text-muted-foreground">
          <p>No notes found with this tag yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => (
            <Link key={note.id} href={`/app/notes/${note.id}`}>
              <div className="p-6 rounded-lg border border-border hover:border-primary hover:shadow-md transition-all cursor-pointer bg-card">
                <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
                  {note.title || 'Untitled Note'}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {note.content || 'No content'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
