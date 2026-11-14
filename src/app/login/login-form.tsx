"use client"

import { useEffect, useState } from "react"
import { MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { sendLoginLink } from "@/lib/supabase/login-link"
import { completeEmailLogin } from "./actions"

const NOT_INVITED = "This account isn’t on the Azisly BD team. Ask your program admin for an invite."

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [busy, setBusy] = useState(false)
  // Email + password is the main way in (people set it from their joining link).
  const [usePassword, setUsePassword] = useState(true)
  const [forgot, setForgot] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Google errors can arrive in the URL fragment, which the server never sees.
  // "Signups not allowed" means a Google account that was never invited.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const description = hash.get("error_description") ?? ""
    if (/signup|not allowed|database error saving new user/i.test(description)) {
      window.location.replace("/login?error=not_invited")
    }
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function sendLink(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)
    const clean = (sentTo ?? email).trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(clean)) return setError("Enter a valid email address.")
    setBusy(true)
    const { result, message } = await sendLoginLink(clean)
    setBusy(false)
    if (result === "not_invited") return setError(NOT_INVITED)
    if (result === "rate_limited") {
      setCooldown(60)
      return setError("A link was sent very recently. Wait a minute, then ask again.")
    }
    if (result === "error") return setError(message ?? "Couldn’t send the link. Try again.")
    setSentTo(clean)
    setCooldown(60)
  }

  async function passwordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const clean = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(clean)) return setError("Enter a valid email address.")
    if (!password) return setError("Enter your password.")
    setBusy(true)
    const { error } = await createClient().auth.signInWithPassword({ email: clean, password })
    if (error) {
      setBusy(false)
      return setError(/invalid/i.test(error.message) ? "Email or password is wrong." : error.message)
    }
    const result = await completeEmailLogin()
    if (result !== "ok") {
      setBusy(false)
      window.location.replace(`/login?error=${result}`)
      return
    }
    window.location.replace("/today")
  }

  async function google() {
    setError(null)
    setBusy(true)
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setBusy(false)
      setError(
        /not enabled|unsupported provider/i.test(error.message)
          ? "Google login isn’t switched on yet. Use your email and password."
          : error.message
      )
    }
  }

  return (
    <div className="space-y-6">
      {usePassword ? (
        <form onSubmit={passwordLogin} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="pw-email">Email</Label>
            <Input
              id="pw-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
            />
          </div>
          <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setForgot((f) => !f)}
          >
            Forgot your password, or never set one?
          </button>
          {forgot && (
            <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand">
              Ask your manager or admin to send you a new password link on WhatsApp. Or{" "}
              <button
                type="button"
                className="font-medium underline underline-offset-2"
                onClick={() => {
                  setUsePassword(false)
                  setError(null)
                }}
              >
                get a login link by email
              </button>
              .
            </p>
          )}
        </form>
      ) : !sentTo ? (
        <form onSubmit={sendLink} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Your email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
          </div>
          <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
            {busy ? "Sending…" : "Email me a login link"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-brand hover:underline"
            onClick={() => {
              setUsePassword(true)
              setError(null)
            }}
          >
            Log in with a password instead
          </button>
        </form>
      ) : (
        <div className="space-y-3 rounded-2xl bg-surface p-6 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <MailCheck className="size-5 text-brand" /> Check your email
          </p>
          <p className="text-muted-foreground">
            We sent a login link to <strong className="text-foreground">{sentTo}</strong>. Tap it to log in. It can take a
            minute to arrive – check spam too. The link works once and expires in an hour.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" disabled={busy || cooldown > 0} onClick={() => sendLink()}>
              {cooldown > 0 ? `Send again in ${cooldown}s` : busy ? "Sending…" : "Send the link again"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSentTo(null)
                setError(null)
              }}
            >
              Use a different email
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-[#fdecea] px-4 py-3 text-sm text-[#b42318]">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="outline" className="h-11 w-full bg-white text-base" onClick={google} disabled={busy}>
        <GoogleIcon /> Continue with Google
      </Button>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
