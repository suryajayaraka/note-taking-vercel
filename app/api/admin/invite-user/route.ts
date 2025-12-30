import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Check if the current user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    const supabaseAdmin = await createAdminClient()

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const userExists = existingUsers?.users.some((u) => u.email === email)

    if (userExists) {
      return NextResponse.json(
        {
          error: `User with email ${email} already exists. You can only invite new users.`,
        },
        { status: 400 },
      )
    }

    // Invite user
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
    })

    if (error) {
      if (error.message.includes("already been registered") || error.message.includes("email_exists")) {
        return NextResponse.json(
          {
            error: `User with email ${email} already exists. You can only invite new users.`,
          },
          { status: 400 },
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("Error inviting user:", error)
    return NextResponse.json({ error: error.message || "Failed to invite user" }, { status: 500 })
  }
}
