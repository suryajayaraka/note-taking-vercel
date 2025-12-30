"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Note, Tag } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Trash2, Share2, Globe, Lock } from "lucide-react"
import { RichTextEditor } from "./rich-text-editor"
import { Badge } from "@/components/ui/badge"

interface NoteEditorProps {
  note: Note
  tags: Tag[]
  onNoteUpdate: (note: Note) => void
  onTagsUpdate: (tags: Tag[]) => void
}

export function NoteEditor({ note, tags, onNoteUpdate, onTagsUpdate }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved")
  const [isPublic, setIsPublic] = useState((note as any).is_public || false)
  const [localTags, setLocalTags] = useState(tags)
  const saveTimeoutRef = useRef<NodeJS.Timeout>()
  const router = useRouter()
  const supabase = createClient()
  const noteIdRef = useRef(note.id)

  const fetchTagsFromServer = async () => {
    try {
      const response = await fetch(`/api/notes/${note.id}/tags`)
      if (response.ok) {
        const { tags: fetchedTags } = await response.json()
        console.log("[v0] Fetched tags from server:", fetchedTags)
        setLocalTags(fetchedTags)
        onTagsUpdate(fetchedTags)
      } else {
        console.error("[v0] Failed to fetch tags:", response.status)
      }
    } catch (err) {
      console.error("[v0] Failed to fetch tags from server:", err)
    }
  }

  useEffect(() => {
    console.log("[v0] NoteEditor: Note changed, resetting state")
    setTitle(note.title)
    setContent(note.content)
    setIsPublic((note as any).is_public || false)
    setLocalTags(tags)
    noteIdRef.current = note.id
    setSaveStatus("saved")
    fetchTagsFromServer()
  }, [note])

  useEffect(() => {
    const extractTagsFromContent = async () => {
      const tagPattern = /#(\w+)/g
      const matches = content.matchAll(tagPattern)
      const foundTags = new Set<string>()

      for (const match of matches) {
        foundTags.add(match[1].toLowerCase())
      }

      if (foundTags.size === 0) return

      try {
        console.log("[v0] Extracting tags from content:", Array.from(foundTags))

        const currentTagNames = new Set(localTags.map((t) => t.name.toLowerCase()))

        for (const tagName of foundTags) {
          if (currentTagNames.has(tagName)) {
            console.log("[v0] Tag already linked:", tagName)
            continue
          }

          console.log("[v0] Linking tag to note via API:", tagName)

          const response = await fetch(`/api/notes/${note.id}/tags`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ tagName }),
          })

          if (response.ok) {
            const { tag } = await response.json()
            console.log("[v0] Tag created/linked successfully:", tag)
            const updatedTags = [...localTags, { id: tag.id, name: tag.name, color: tag.color }]
            setLocalTags(updatedTags)
            onTagsUpdate(updatedTags)
            currentTagNames.add(tag.name.toLowerCase())
          } else {
            const error = await response.json()
            console.error("[v0] Failed to add tag via API:", error)
          }
        }
      } catch (err) {
        console.error("[v0] Failed to extract tags:", err)
      }
    }

    const timeout = setTimeout(() => {
      extractTagsFromContent()
    }, 2000)

    return () => clearTimeout(timeout)
  }, [content, note, localTags, onTagsUpdate])

  useEffect(() => {
    if (title === note.title && content === note.content) {
      setSaveStatus("saved")
      return
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    setSaveStatus("unsaved")

    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus("saving")
      setIsSaving(true)

      try {
        const { error } = await supabase
          .from("notes")
          .update({
            title: title || "Untitled Note",
            content: content,
            updated_at: new Date().toISOString(),
            is_public: isPublic,
          })
          .eq("id", noteIdRef.current)

        if (error) throw error

        onNoteUpdate({
          ...note,
          title: title || "Untitled Note",
          content: content,
          is_public: isPublic,
        })
        setSaveStatus("saved")
        console.log("[v0] Note saved successfully, status: All changes saved")
      } catch (err) {
        console.error("Failed to save note:", err)
        setSaveStatus("unsaved")
      } finally {
        setIsSaving(false)
      }
    }, 1000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [title, content, note, supabase, onNoteUpdate, isPublic])

  const handleShare = async () => {
    const url = isPublic
      ? `${window.location.origin}/share/${note.id}`
      : `${window.location.origin}/app/notes/${note.id}`

    try {
      await navigator.clipboard.writeText(url)
      alert(isPublic ? "Public share link copied to clipboard!" : "Link copied to clipboard!")
    } catch (err) {
      console.error("Failed to copy:", err)
      const textArea = document.createElement("textarea")
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      alert(isPublic ? "Public share link copied to clipboard!" : "Link copied to clipboard!")
    }
  }

  const handleDeleteNote = async () => {
    if (!confirm("Are you sure you want to delete this note?")) return

    try {
      const { error } = await supabase.from("notes").delete().eq("id", note.id)

      if (error) throw error
      router.push("/app")
    } catch (err) {
      console.error("Failed to delete note:", err)
    }
  }

  const handleTogglePublic = async () => {
    const newIsPublic = !isPublic
    try {
      const { error } = await supabase.from("notes").update({ is_public: newIsPublic }).eq("id", note.id)

      if (error) throw error

      setIsPublic(newIsPublic)
      onNoteUpdate({ ...note, is_public: newIsPublic } as any)

      if (newIsPublic) {
        alert("Note is now public! Anyone with the link can view it.")
      } else {
        alert("Note is now private. Only you can view it.")
      }
    } catch (err) {
      console.error("Failed to toggle public status:", err)
      alert("Failed to update sharing settings")
    }
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-background to-background/95">
      <div className="border-b border-border/50 p-3 md:p-6 flex items-center justify-between gap-2 backdrop-blur-sm bg-card/30">
        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/app")}
            title="Back to Dashboard"
            className="flex-shrink-0 hover:bg-accent/50"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
          </Button>

          <div className="flex-1 min-w-0">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg md:text-2xl font-bold bg-transparent border-0 p-0 focus-visible:ring-0 mb-1 md:mb-2"
              placeholder="Note title"
            />
            <p className="text-xs md:text-sm text-muted-foreground">
              {saveStatus === "saved" && "All changes saved"}
              {saveStatus === "saving" && "Saving..."}
              {saveStatus === "unsaved" && "Unsaved changes"}
              {" • "}
              {isPublic ? (
                <span className="text-green-600 dark:text-green-400 inline-flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Public
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Private
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <Button
            variant={isPublic ? "default" : "ghost"}
            size="icon"
            onClick={handleTogglePublic}
            title={isPublic ? "Make private" : "Make public"}
            className="h-8 w-8 md:h-10 md:w-10 hover:scale-110 transition-transform"
          >
            {isPublic ? <Globe className="w-4 h-4 md:w-5 md:h-5" /> : <Lock className="w-4 h-4 md:w-5 md:h-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            title="Share note"
            className="h-8 w-8 md:h-10 md:w-10 hover:scale-110 transition-transform"
          >
            <Share2 className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDeleteNote}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 md:h-10 md:w-10 hover:scale-110 transition-transform"
          >
            <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden pb-24 md:pb-20">
        <RichTextEditor value={content} onChange={setContent} placeholder="Start typing your note..." />
      </div>

      <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-card/95 backdrop-blur-md border-t border-border/50 shadow-xl z-40">
        <TagEditorFloating noteId={note.id} tags={localTags} onTagsUpdate={setLocalTags} />
      </div>
    </div>
  )
}

function TagEditorFloating({
  noteId,
  tags,
  onTagsUpdate,
}: {
  noteId: string
  tags: Tag[]
  onTagsUpdate: (tags: Tag[]) => void
}) {
  const [input, setInput] = useState("")
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const loadAllTags = async () => {
      try {
        const { data, error } = await supabase.from("tags").select("*").order("name", { ascending: true })

        if (error) throw error
        setAllTags(data || [])
      } catch (err) {
        console.error("Failed to load tags:", err)
      }
    }

    loadAllTags()
  }, [supabase])

  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([])
      return
    }

    const query = input.replace(/#/g, "").toLowerCase()
    const filtered = allTags.filter(
      (tag) => tag.name.toLowerCase().includes(query) && !tags.some((t) => t.id === tag.id),
    )
    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
  }, [input, allTags, tags])

  const addTag = async (tag: Tag) => {
    if (tags.some((t) => t.id === tag.id)) {
      console.log("[v0] Tag already exists, skipping:", tag.name)
      return
    }

    try {
      const response = await fetch(`/api/notes/${noteId}/tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tagName: tag.name }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to add tag")
      }

      onTagsUpdate([...tags, tag])
      setInput("")
      setShowSuggestions(false)
    } catch (err) {
      console.error("Failed to add tag:", err)
    }
  }

  const handleCreateTag = async () => {
    if (!input.trim()) return

    const tagName = input.replace(/#/g, "").trim()
    if (!tagName) return

    try {
      const response = await fetch(`/api/notes/${noteId}/tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tagName }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create tag")
      }

      const { tag: newTag } = await response.json()

      onTagsUpdate([...tags, newTag])
      setAllTags([...allTags, newTag].filter((t, i, a) => a.findIndex((x) => x.id === t.id) === i))
      setInput("")
      setShowSuggestions(false)
    } catch (err) {
      console.error("Failed to create tag:", err)
    }
  }

  const removeTag = async (tag: Tag) => {
    try {
      const response = await fetch(`/api/notes/${noteId}/tags`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tagId: tag.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to remove tag")
      }

      onTagsUpdate(tags.filter((t) => t.id !== tag.id))
    } catch (err) {
      console.error("Failed to remove tag:", err)
    }
  }

  const navigateToTag = (tagName: string) => {
    router.push(`/app/tags/${encodeURIComponent(tagName)}`)
  }

  return (
    <div className="p-4 space-y-3">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all hover:scale-105 border-primary/20"
              onClick={() => navigateToTag(tag.name)}
            >
              <span onClick={(e) => e.stopPropagation()}>#{tag.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(tag)
                }}
                className="ml-2 hover:text-destructive"
              >
                <span className="text-xs">×</span>
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type #tag to add tags..."
            className="flex-1 bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                e.preventDefault()
                handleCreateTag()
              }
            }}
          />
          {input.trim() && (
            <Button
              size="sm"
              onClick={handleCreateTag}
              variant="outline"
              className="hover:bg-primary hover:text-primary-foreground transition-all bg-transparent"
            >
              Add Tag
            </Button>
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-card/95 backdrop-blur-md border border-border/50 rounded-lg shadow-xl z-50 max-h-48 overflow-auto">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                onClick={() => addTag(suggestion)}
                className="w-full text-left px-4 py-2 hover:bg-primary/10 transition-colors border-b border-border/30 last:border-0"
              >
                <span className="text-sm">#{suggestion.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function generateRandomColor(): string {
  const colors = [
    "#3b82f6", // blue
    "#ef4444", // red
    "#10b981", // green
    "#f59e0b", // amber
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#f97316", // orange
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}
