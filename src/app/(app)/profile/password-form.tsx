"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { changePassword } from "./actions"

export function PasswordForm() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [again, setAgain] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (next !== again) return setError("The new passwords don’t match.")
    setBusy(true)
    const res = await changePassword(current, next)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    toast.success("Password changed")
    setCurrent("")
    setNext("")
    setAgain("")
  }

  return (
    <form onSubmit={submit} className="grid max-w-md gap-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="pw-current">Current password</Label>
        <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-new">New password</Label>
        <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <p className="text-xs text-muted-foreground">At least 8 characters, with letters and a number.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-again">New password again</Label>
        <Input id="pw-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="justify-self-start" disabled={busy || !current || !next || !again}>
        {busy ? "Saving…" : "Change password"}
      </Button>
    </form>
  )
}
