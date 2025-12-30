"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Menu, X, User, LogOut } from "lucide-react"

export function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push("/login")
      } else {
        setUser(session.user)
      }
      setIsLoading(false)
    }

    checkUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.push("/login")
      } else {
        setUser(session.user)
      }
    })

    return () => subscription?.unsubscribe()
  }, [supabase, router])

  useEffect(() => {
    if (pathname === "/app") {
      console.log("[v0] Returned to dashboard, refreshing sidebar")
      setRefreshTrigger((prev) => prev + 1)
    }
    setIsSidebarOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <div className="md:hidden bg-card border-b border-border px-4 py-3 flex items-center justify-between z-50">
        <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="flex-shrink-0">
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>

        <h1 className="text-lg font-semibold">Notes</h1>

        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex-shrink-0"
          >
            <User className="w-5 h-5" />
          </Button>

          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50 py-2">
                <div className="px-4 py-2 border-b border-border">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                </div>
                <button
                  onClick={async () => {
                    setShowProfileMenu(false)
                    await handleLogout()
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {isSidebarOpen && (
          <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsSidebarOpen(false)} />
        )}

        <div
          className={`
          fixed md:relative inset-y-0 left-0 z-40 md:z-0
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          w-64 md:w-64
          mt-[57px] md:mt-0
        `}
        >
          <Sidebar onLogout={handleLogout} refreshTrigger={refreshTrigger} user={user} />
        </div>

        <main className="flex-1 overflow-auto w-full">{children}</main>
      </div>
    </div>
  )
}
