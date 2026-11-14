"use client"

import { useState } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { completeJoin } from "./actions"

export function JoinForm({ token, email }: { token: string; email: string }) {
  const [password, setPassword] = useState("")
  const [again, setAgain] = useState("")
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== again) return setError("The two passwords don’t match.")
    setBusy(true)
    const res = await completeJoin(token, password)
    if (!res.ok) {
      setBusy(false)
      return setError(res.error)
    }
    window.location.replace("/today")
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="join-email">Email</Label>
        <Input id="join-email" value={email} readOnly autoComplete="username" className="h-11 bg-muted/50" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="join-pw">Password</Label>
        <div className="relative">
          <Input
            id="join-pw"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 pr-11"
            required
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">At least 8 characters, with letters and a number.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="join-pw2">Type it again</Label>
        <Input
          id="join-pw2"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          className="h-11"
          required
        />
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-[#fdecea] px-4 py-3 text-sm text-[#b42318]">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={busy || !password || !again}>
        {busy && <Loader2 className="animate-spin" />}
        Save password and open the CRM
      </Button>
    </form>
  )
}
