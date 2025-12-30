import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  await supabase.auth.getUser()

  if (request.nextUrl.pathname.startsWith("/share")) {
    return response
  }

  // Redirect to login if accessing protected routes
  if (request.nextUrl.pathname.startsWith("/app")) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url))
    }

    const { data: profile, error } = await supabaseAdmin
      .from("user_profiles")
      .select("is_approved, role")
      .eq("id", user.id)
      .single()

    if (error) {
      console.error("Profile check error:", error.message)
    }

    // If not admin and not approved, redirect to pending page
    if (profile && profile.role !== "admin" && !profile.is_approved && request.nextUrl.pathname !== "/app/pending") {
      return NextResponse.redirect(new URL("/app/pending", request.url))
    }

    // If approved or admin and trying to access pending page, redirect to app
    if (profile && (profile.role === "admin" || profile.is_approved) && request.nextUrl.pathname === "/app/pending") {
      return NextResponse.redirect(new URL("/app", request.url))
    }
  }

  // Redirect to app if already logged in and accessing login
  if (request.nextUrl.pathname === "/login") {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      return NextResponse.redirect(new URL("/app", request.url))
    }
  }

  return response
}

export const config = {
  matcher: ["/app/:path*", "/login", "/share/:path*"],
}
