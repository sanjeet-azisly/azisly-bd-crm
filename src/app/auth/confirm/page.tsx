"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Logo } from "@/components/logo"
import { createClient } from "@/lib/supabase/client"
import { completeEmailLogin } from "@/app/login/actions"

// The login link in the email lands here with the session in the URL fragment.
export default function ConfirmPage() {
  const router = useRouter()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    window.history.replaceState(null, "", window.location.pathname)
    const access_token = params.get("access_token")
    const refresh_token = params.get("refresh_token")
    if (!access_token || !refresh_token) {
      setFailed(true)
      return
    }
    ;(async () => {
      const { error } = await createClient().auth.setSession({ access_token, refresh_token })
      if (error) return setFailed(true)
      const result = await completeEmailLogin()
      if (result !== "ok") return router.replace(`/login?error=${result}`)
      router.replace("/today")
      router.refresh()
    })()
  }, [router])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-4 text-center">
      <Logo className="text-2xl" />
      {failed ? (
        <>
          <p className="max-w-xs text-sm text-muted-foreground">
            This login link has expired or was already used. Links work once and expire after an hour.
          </p>
          <Link href="/login" className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background">
            Get a new login link
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Logging you in…</p>
      )}
    </main>
  )
}
