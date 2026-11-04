"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import { devLogin } from "./actions"

export function DevLogin({ people }: { people: { email: string; label: string }[] }) {
  const router = useRouter()
  const [email, setEmail] = useState(people[0]?.email ?? "")
  const [busy, setBusy] = useState(false)
  return (
    <div className="mt-8 space-y-2 rounded-xl border-2 border-dashed border-[#f3c76b] bg-[#fdf1d6] p-5">
      <p className="text-sm font-medium text-foreground">Testing on this Mac only</p>
      <p className="text-xs text-foreground">Log in as any team member without email. This box never appears in the live app.</p>
      <NativeSelect aria-label="Team member" value={email} onChange={(e) => setEmail(e.target.value)}>
        {people.map((p) => (
          <option key={p.email} value={p.email}>
            {p.label}
          </option>
        ))}
      </NativeSelect>
      <Button
        className="w-full"
        variant="secondary"
        disabled={busy || !email}
        onClick={async () => {
          setBusy(true)
          const result = await devLogin(email)
          if (result !== "ok") {
            setBusy(false)
            router.replace(`/login?error=${result}`)
            return
          }
          router.replace("/today")
          router.refresh()
        }}
      >
        {busy ? "Logging in…" : "Log in as this person"}
      </Button>
    </div>
  )
}
