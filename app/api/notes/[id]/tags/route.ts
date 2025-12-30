import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tagName } = await request.json()
    const { id: noteId } = await params

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set() {},
          remove() {},
        },
      },
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user owns the note
    const { data: note, error: noteError } = await supabase.from("notes").select("user_id").eq("id", noteId).single()

    if (noteError || !note || note.user_id !== user.id) {
      return NextResponse.json({ error: "Note not found or unauthorized" }, { status: 404 })
    }

    const adminSupabase = await createAdminClient()

    const { data: existingTag } = await adminSupabase
      .from("tags")
      .select("*")
      .eq("name", tagName)
      .eq("user_id", user.id)
      .maybeSingle()

    let tag = existingTag

    // Create tag if it doesn't exist
    if (!tag) {
      const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"]
      const color = colors[Math.floor(Math.random() * colors.length)]

      const { data: newTag, error: tagError } = await adminSupabase
        .from("tags")
        .insert({
          name: tagName,
          color: color,
          user_id: user.id,
        })
        .select()
        .single()

      if (tagError) {
        console.error("Failed to create tag:", tagError)
        return NextResponse.json({ error: "Failed to create tag" }, { status: 500 })
      }

      tag = newTag
    }

    // Link tag to note (upsert to handle duplicates)
    const { error: linkError } = await adminSupabase.from("note_tags").upsert(
      {
        note_id: noteId,
        tag_id: tag.id,
      },
      {
        onConflict: "note_id,tag_id",
        ignoreDuplicates: true,
      },
    )

    if (linkError) {
      console.error("Failed to link tag:", linkError)
      return NextResponse.json({ error: "Failed to link tag" }, { status: 500 })
    }

    return NextResponse.json({ tag })
  } catch (error) {
    console.error("Tag operation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tagId } = await request.json()
    const { id: noteId } = await params

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set() {},
          remove() {},
        },
      },
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user owns the note
    const { data: note, error: noteError } = await supabase.from("notes").select("user_id").eq("id", noteId).single()

    if (noteError || !note || note.user_id !== user.id) {
      return NextResponse.json({ error: "Note not found or unauthorized" }, { status: 404 })
    }

    const adminSupabase = await createAdminClient()

    const { error: deleteError } = await adminSupabase
      .from("note_tags")
      .delete()
      .eq("note_id", noteId)
      .eq("tag_id", tagId)

    if (deleteError) {
      console.error("Failed to delete tag link:", deleteError)
      return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Tag delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: noteId } = await params

    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set() {},
          remove() {},
        },
      },
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.log("[v0] GET tags - Unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user owns the note
    const { data: note, error: noteError } = await supabase.from("notes").select("user_id").eq("id", noteId).single()

    if (noteError || !note || note.user_id !== user.id) {
      console.log("[v0] GET tags - Note not found or unauthorized")
      return NextResponse.json({ error: "Note not found or unauthorized" }, { status: 404 })
    }

    // Use admin client to fetch tags bypassing RLS
    const adminSupabase = await createAdminClient()

    const { data: noteTags, error: fetchError } = await adminSupabase
      .from("note_tags")
      .select("tag_id, tags(id, name, color)")
      .eq("note_id", noteId)

    if (fetchError) {
      console.log("[v0] GET tags - Fetch error:", fetchError)
      return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 })
    }

    console.log("[v0] GET tags - Found", noteTags?.length || 0, "tags")

    // Transform the response to flatten the tag data
    const tags =
      noteTags?.map((nt: any) => ({
        id: nt.tags.id,
        name: nt.tags.name,
        color: nt.tags.color,
      })) || []

    return NextResponse.json({ tags })
  } catch (error) {
    console.error("[v0] GET tags error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
