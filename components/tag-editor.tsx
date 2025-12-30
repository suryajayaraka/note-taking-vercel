"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Tag } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X } from "lucide-react"

interface TagEditorProps {
  noteId: string
  tags: Tag[]
  onTagsUpdate: (tags: Tag[]) => void
}

export function TagEditor({ noteId, tags, onTagsUpdate }: TagEditorProps) {
  const [input, setInput] = useState("")
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  // Load all available tags
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

  // Filter suggestions based on input
  const filteredSuggestions = useMemo(() => {
    if (!input.trim()) return []

    const query = input.toLowerCase()
    return allTags.filter((tag) => tag.name.toLowerCase().includes(query) && !tags.some((t) => t.id === tag.id))
  }, [input, allTags, tags])

  // Handle tag input
  const handleTagInput = (value: string) => {
    setInput(value)

    // Show suggestions if input starts with #
    if (value.includes("#")) {
      setShowSuggestions(true)
      const afterHash = value.substring(value.lastIndexOf("#") + 1).trim()
      if (afterHash.length > 0) {
        setSuggestions(filteredSuggestions)
      } else {
        setSuggestions(allTags.filter((tag) => !tags.some((t) => t.id === tag.id)))
      }
    } else {
      setShowSuggestions(false)
    }
  }

  // Add tag
  const addTag = async (tag: Tag) => {
    try {
      const { error } = await supabase.from("note_tags").insert({
        note_id: noteId,
        tag_id: tag.id,
      })

      if (error) throw error

      onTagsUpdate([...tags, tag])
      setInput("")
      setShowSuggestions(false)
    } catch (err) {
      console.error("Failed to add tag:", err)
    }
  }

  // Create and add new tag
  const handleCreateTag = async () => {
    if (!input.trim()) return

    const tagName = input.replace(/#/g, "").trim()
    if (!tagName) return

    try {
      const { data: existingTag } = await supabase.from("tags").select("*").eq("name", tagName).single()

      let newTag = existingTag

      if (!existingTag) {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          console.error("User not authenticated")
          return
        }

        const { data: createdTag, error } = await supabase
          .from("tags")
          .insert({
            name: tagName,
            color: generateRandomColor(),
            user_id: user.id, // Include user_id to satisfy RLS policy
          })
          .select()
          .single()

        if (error) {
          console.error("Failed to create tag:", error)
          throw error
        }
        newTag = createdTag
      }

      if (newTag) {
        await addTag(newTag)
        setAllTags([...allTags, newTag].filter((t, i, a) => a.findIndex((x) => x.id === t.id) === i))
      }
    } catch (err) {
      console.error("Failed to create tag:", err)
    }
  }

  // Remove tag
  const removeTag = async (tag: Tag) => {
    try {
      const { error } = await supabase.from("note_tags").delete().eq("note_id", noteId).eq("tag_id", tag.id)

      if (error) throw error

      onTagsUpdate(tags.filter((t) => t.id !== tag.id))
    } catch (err) {
      console.error("Failed to remove tag:", err)
    }
  }

  // Navigate to tag filter
  const navigateToTag = (tagName: string) => {
    router.push(`/app/tags/${encodeURIComponent(tagName)}`)
  }

  return (
    <div className="border-b border-border p-6 space-y-4">
      {/* Display selected tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="cursor-pointer hover:bg-accent"
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
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Tag input */}
      <div className="relative">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => handleTagInput(e.target.value)}
            placeholder="Type #tag to add tags..."
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                e.preventDefault()
                handleCreateTag()
              }
            }}
          />
          {input.trim() && (
            <Button size="sm" onClick={handleCreateTag} variant="outline">
              Add Tag
            </Button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-auto">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                onClick={() => addTag(suggestion)}
                className="w-full text-left px-4 py-2 hover:bg-accent transition-colors border-b border-border last:border-0"
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
