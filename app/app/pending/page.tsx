"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock } from "lucide-react"

export default function PendingApprovalPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkApprovalStatus()
  }, [])

  const checkApprovalStatus = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login")
      return
    }

    const { data: profile } = await supabase.from("user_profiles").select("is_approved").eq("id", user.id).single()

    if (profile?.is_approved) {
      router.push("/app")
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Clock className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Pending Approval</CardTitle>
          <CardDescription>Your account is waiting for admin approval</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            Your registration has been received. Please wait for an administrator to approve your account before you can
            access the note-taking app.
          </p>
          <Button onClick={handleSignOut} variant="outline" className="w-full bg-transparent">
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
