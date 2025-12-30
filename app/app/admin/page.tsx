"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { Users, UserPlus, Trash2 } from "lucide-react"

interface UserProfile {
  id: string
  email: string
  role: string
  is_approved: boolean
  created_at: string
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState("")
  const [isInviting, setIsInviting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkAdminAndLoadUsers()
  }, [])

  const checkAdminAndLoadUsers = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

      if (profile?.role !== "admin") {
        router.push("/app")
        return
      }

      setIsAdmin(true)
      await loadUsers()
    } catch (error) {
      console.error("Error checking admin status:", error)
      router.push("/app")
    }
  }

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false })

      if (profilesError) throw profilesError

      // Fetch emails from Supabase auth for each user
      const usersWithEmails = await Promise.all(
        (profiles || []).map(async (profile) => {
          try {
            const {
              data: { user },
            } = await supabase.auth.admin.getUserById(profile.id)
            return {
              ...profile,
              email: user?.email || profile.email || "No email",
            }
          } catch (err) {
            return {
              ...profile,
              email: profile.email || "Unknown",
            }
          }
        }),
      )

      setUsers(usersWithEmails)
    } catch (error) {
      console.error("Error loading users:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Use API route for inviting users instead of client-side admin methods
  const inviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsInviting(true)
    setInviteMessage(null)

    try {
      const response = await fetch("/api/admin/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newUserEmail }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to send invitation")
      }

      setInviteMessage({
        type: "success",
        text: `Invitation sent to ${newUserEmail}. They will receive an email to set their password.`,
      })
      setNewUserEmail("")
      await loadUsers()
    } catch (error: any) {
      setInviteMessage({
        type: "error",
        text: error.message || "Failed to send invitation",
      })
    } finally {
      setIsInviting(false)
    }
  }

  // Use API route for deleting users instead of client-side admin methods
  const deleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}?`)) return

    try {
      const response = await fetch("/api/admin/delete-user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete user")
      }

      setInviteMessage({
        type: "success",
        text: `User ${userEmail} deleted successfully`,
      })
      await loadUsers()
    } catch (error: any) {
      setInviteMessage({
        type: "error",
        text: error.message || "Failed to delete user",
      })
    }
  }

  const approveUser = async (userId: string) => {
    try {
      const { error } = await supabase.from("user_profiles").update({ is_approved: true }).eq("id", userId)

      if (error) throw error
      await loadUsers()
    } catch (error) {
      console.error("Error approving user:", error)
      alert("Failed to approve user")
    }
  }

  if (!isAdmin) return null

  const allUsers = users.filter((u) => u.is_approved || u.role === "admin")

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground mt-1">Invite users and manage access</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/app")}>
            Back to Notes
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Invite New User
            </CardTitle>
            <CardDescription>Send an invitation email to create a new account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={inviteUser} className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                  disabled={isInviting}
                  className="flex-1"
                />
                <Button type="submit" disabled={isInviting}>
                  {isInviting ? "Sending..." : "Send Invite"}
                </Button>
              </div>
              {inviteMessage && (
                <div
                  className={`p-3 text-sm rounded-md ${
                    inviteMessage.type === "success"
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {inviteMessage.text}
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* All Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              All Users ({allUsers.length})
            </CardTitle>
            <CardDescription>Users with access to the app</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <div className="space-y-2">
                {allUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                    <div>
                      <p className="font-medium">{user.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Role: {user.role} • Joined: {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {user.role !== "admin" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteUser(user.id, user.email)}
                        className="gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
