"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Note, Tag } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LogOut, Plus, Archive, Search, Hash, Trash2, Network, User, Key, Users, Share2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface SidebarProps {
  onLogout: () => void
  refreshTrigger?: number
  user?: any // Added user prop to display in profile menu
}

interface NoteWithTags extends Note {
  tags?: Tag[]
}

export function Sidebar({ onLogout, refreshTrigger, user }: SidebarProps) {
  const [notes, setNotes] = useState<NoteWithTags[]>([])
  const [filteredNotes, setFilteredNotes] = useState<NoteWithTags[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [tagRelationships, setTagRelationships] = useState<Map<string, Set<string>>>(new Map())
  const [showRelationships, setShowRelationships] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false) // Added profile menu state for desktop
  const [openMenuId, setOpenMenuId] = useState<string | null>(null) // Add state for mobile menu
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const loadNotes = async () => {
    try {
      console.log("[v0] Loading notes for sidebar...")
      const { data: notesData, error } = await supabase
        .from("notes")
        .select("*")
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })

      if (error) throw error

      const notesWithTags = await Promise.all(
        (notesData || []).map(async (note) => {
          const { data: tagData } = await supabase.from("note_tags").select("tags(*)").eq("note_id", note.id)

          return {
            ...note,
            tags: tagData?.map((nt: any) => nt.tags) || [],
          }
        }),
      )

      const tagsSet = new Set<string>()
      const tagsMap = new Map<string, Tag>()
      const relationships = new Map<string, Set<string>>()

      notesWithTags.forEach((note) => {
        const noteTags = note.tags || []

        noteTags.forEach((tag) => {
          if (!tagsSet.has(tag.id)) {
            tagsSet.add(tag.id)
            tagsMap.set(tag.id, tag)
          }

          if (!relationships.has(tag.name)) {
            relationships.set(tag.name, new Set())
          }

          noteTags.forEach((otherTag) => {
            if (tag.id !== otherTag.id) {
              relationships.get(tag.name)?.add(otherTag.name)
            }
          })
        })
      })

      setAllTags(Array.from(tagsMap.values()))
      setTagRelationships(relationships)

      console.log("[v0] Loaded notes:", notesWithTags.length)
      setNotes([...notesWithTags])
      setFilteredNotes([...notesWithTags])
    } catch (err) {
      console.error("Failed to load notes:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadNotes()

    const channel = supabase.channel("sidebar-notes-changes")

    channel
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notes",
        },
        (payload) => {
          console.log("[v0] Note updated, reloading all notes")
          setIsLoading(true)
          loadNotes()
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notes",
        },
        () => {
          console.log("[v0] Note inserted, reloading all notes")
          setIsLoading(true)
          loadNotes()
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notes",
        },
        () => {
          setIsLoading(true)
          loadNotes()
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "note_tags",
        },
        () => {
          setIsLoading(true)
          loadNotes()
        },
      )
      .subscribe((status) => {
        console.log("[v0] Sidebar subscription status:", status)
      })

    return () => {
      channel.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (pathname?.startsWith("/app/notes/")) {
      console.log("[v0] Route changed, reloading sidebar")
      loadNotes()
    }
  }, [pathname])

  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      console.log("[v0] Sidebar: Refresh triggered from parent")
      loadNotes()
    }
  }, [refreshTrigger])

  useEffect(() => {
    let filtered = notes

    if (selectedTag) {
      filtered = filtered.filter((note) => note.tags?.some((tag) => tag.name === selectedTag))
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (query.startsWith("#")) {
        const tagQuery = query.slice(1)
        filtered = filtered.filter((note) => note.tags?.some((tag) => tag.name.toLowerCase().includes(tagQuery)))
      } else {
        filtered = filtered.filter(
          (note) => note.title.toLowerCase().includes(query) || note.content.toLowerCase().includes(query),
        )
      }
    }

    setFilteredNotes(filtered)
  }, [searchQuery, notes, selectedTag])

  const handleNewNote = async () => {
    try {
      const now = new Date()
      const day = String(now.getDate()).padStart(2, "0")
      const month = String(now.getMonth() + 1).padStart(2, "0")
      const year = now.getFullYear()
      const dateTitle = `${day}/${month}/${year}`

      const { data, error } = await supabase
        .from("notes")
        .insert({
          title: dateTitle, // set default title to the formatted date
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

  const handleArchiveNote = async (noteId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      const { error } = await supabase.from("notes").update({ is_archived: true }).eq("id", noteId)

      if (error) throw error
      await loadNotes()
    } catch (err) {
      console.error("Failed to archive note:", err)
    }
  }

  const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm("Are you sure you want to delete this note?")) return

    try {
      const { error } = await supabase.from("notes").delete().eq("id", noteId)

      if (error) throw error
      await loadNotes()
    } catch (err) {
      console.error("Failed to delete note:", err)
    }
  }

  const handleShareNote = async (noteId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const shareUrl = `${window.location.origin}/share/${noteId}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      alert("Share link copied to clipboard!")
    } catch (err) {
      console.error("Failed to copy share link:", err)
      alert("Failed to copy share link")
    }
  }

  return (
    <aside className="w-full md:w-64 bg-card/50 backdrop-blur-sm border-r border-border/50 flex flex-col h-full shadow-sm">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-border/50">
        <h1 className="text-lg md:text-xl font-bold text-foreground mb-3 md:mb-4 bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
          Notes
        </h1>
        <Button onClick={handleNewNote} className="w-full shadow-md hover:shadow-lg transition-shadow" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Note
        </Button>
      </div>

      {/* Search */}
      <div className="p-3 md:p-4 border-b border-border/50">
        <div className="relative mb-2 md:mb-3">
          <Search className="w-3 h-3 md:w-4 md:h-4 absolute left-2 top-2 md:top-2.5 text-muted-foreground" />
          <Input
            placeholder="Search notes or #tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 md:pl-8 h-8 text-xs md:text-sm bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
          />
        </div>

        {allTags.length > 0 && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="w-full mb-2 text-xs bg-background/50 border-border/50 hover:border-primary/50 transition-colors"
              onClick={() => setShowRelationships(!showRelationships)}
            >
              <Network className="w-3 h-3 mr-2" />
              {showRelationships ? "Hide" : "Show"} Tag Relationships
            </Button>

            {showRelationships && selectedTag && tagRelationships.get(selectedTag) && (
              <div className="mb-2 md:mb-3 p-2 md:p-3 bg-primary/5 rounded-lg border border-primary/20 backdrop-blur-sm">
                <p className="text-xs font-semibold text-foreground mb-1 md:mb-2">
                  Tags related to <span className="text-primary">#{selectedTag}</span>:
                </p>
                <div className="flex flex-wrap gap-1 md:gap-1.5">
                  {Array.from(tagRelationships.get(selectedTag) || []).map((relatedTag) => {
                    const relCount = tagRelationships.get(relatedTag)?.size || 0
                    return (
                      <Badge
                        key={relatedTag}
                        variant="secondary"
                        className="cursor-pointer text-xs hover:bg-primary hover:text-primary-foreground transition-all hover:scale-105"
                        onClick={() => setSelectedTag(relatedTag)}
                        title={`Click to filter by #${relatedTag} (${relCount} related tags)`}
                      >
                        #{relatedTag}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-1 md:gap-1.5">
              {allTags.slice(0, showRelationships ? 10 : 5).map((tag) => {
                const relatedCount = tagRelationships.get(tag.name)?.size || 0
                const isSelected = selectedTag === tag.name
                return (
                  <Badge
                    key={tag.id}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer text-xs hover:opacity-80 transition-all hover:scale-105"
                    onClick={() => setSelectedTag(isSelected ? null : tag.name)}
                    title={
                      showRelationships && relatedCount > 0
                        ? `${relatedCount} related tag${relatedCount > 1 ? "s" : ""}`
                        : undefined
                    }
                  >
                    <Hash className="w-3 h-3 mr-0.5" />
                    {tag.name}
                    {showRelationships && relatedCount > 0 && (
                      <span className="ml-1 text-[10px] font-semibold opacity-70">+{relatedCount}</span>
                    )}
                  </Badge>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-3 md:p-4 text-xs md:text-sm text-muted-foreground">Loading...</div>
        ) : filteredNotes.length === 0 ? (
          <div className="p-3 md:p-4 text-xs md:text-sm text-muted-foreground">
            {selectedTag || searchQuery ? "No matching notes found" : "No notes yet. Create one to get started!"}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredNotes.map((note) => {
              const uniqueTags = Array.from(new Map((note.tags || []).map((tag) => [tag.id, tag])).values())

              return (
                <div
                  key={note.id}
                  onClick={() => {
                    console.log("[v0] Sidebar: Navigating to note:", note.id)
                    router.push(`/app/notes/${note.id}`)
                  }}
                  className="p-2 md:p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-all group relative backdrop-blur-sm border border-transparent hover:border-primary/20 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs md:text-sm line-clamp-1 text-foreground">
                        {note.title || "Untitled Note"}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                        {note.content.replace(/<[^>]*>/g, "").substring(0, 50) || "No content"}
                      </p>
                      {uniqueTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {uniqueTags.slice(0, 3).map((tag) => (
                            <Badge key={tag.id} variant="secondary" className="text-xs">
                              #{tag.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity md:flex hidden">
                      <button
                        onClick={(e) => handleArchiveNote(note.id, e)}
                        className="p-1.5 hover:bg-accent rounded-md transition-colors"
                        title="Archive note"
                      >
                        <Archive className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                      <button
                        onClick={(e) => handleShareNote(note.id, e)}
                        className="p-1.5 hover:bg-accent rounded-md transition-colors"
                        title="Share note"
                      >
                        <Share2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteNote(note.id, e)}
                        className="p-1.5 hover:bg-accent rounded-md transition-colors"
                        title="Delete note"
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>

                    <div className="relative md:hidden">
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === note.id ? null : note.id)
                        }}
                        className="p-1.5 hover:bg-accent rounded-md transition-colors"
                      >
                        <svg className="w-5 h-5 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 11-4 0 2 2 0 014 0zM10 12a2 2 0 11-4 0 2 2 0 014 0zM10 18a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </button>

                      {openMenuId === note.id && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-40 w-40">
                            <button
                              onClick={(e) => {
                                handleArchiveNote(note.id, e)
                                setOpenMenuId(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 border-b border-border"
                            >
                              <Archive className="w-4 h-4" />
                              Archive
                            </button>
                            <button
                              onClick={(e) => {
                                handleShareNote(note.id, e)
                                setOpenMenuId(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 border-b border-border"
                            >
                              <Share2 className="w-4 h-4" />
                              Share
                            </button>
                            <button
                              onClick={(e) => {
                                handleDeleteNote(note.id, e)
                                setOpenMenuId(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border/50 p-3 md:p-4 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start hover:bg-accent text-xs md:text-sm"
          onClick={() => router.push("/app/settings")}
        >
          <Key className="w-3 h-3 md:w-4 md:h-4 mr-2" />
          Change Password
        </Button>

        {user?.email === "suryajayaraka@gmail.com" && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start hover:bg-accent text-xs md:text-sm"
            onClick={() => router.push("/app/admin")}
          >
            <Users className="w-3 h-3 md:w-4 md:h-4 mr-2" />
            User Management
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start hover:bg-accent text-xs md:text-sm"
          onClick={() => router.push("/app/archived")}
        >
          <Archive className="w-3 h-3 md:w-4 md:h-4 mr-2" />
          Archived
        </Button>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start hover:bg-accent text-xs md:text-sm"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <User className="w-3 h-3 md:w-4 md:h-4 mr-2" />
            Profile
          </Button>

          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
              <div className="absolute bottom-full left-0 mb-1 w-full bg-card border border-border rounded-lg shadow-lg z-50 py-2">
                <div className="px-4 py-2 border-b border-border">
                  <p className="text-xs font-medium truncate">{user?.email || "User"}</p>
                </div>
                <button
                  onClick={() => {
                    setShowProfileMenu(false)
                    onLogout()
                  }}
                  className="w-full px-4 py-2 text-left text-xs hover:bg-accent flex items-center gap-2 text-destructive"
                >
                  <LogOut className="w-3 h-3" />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
