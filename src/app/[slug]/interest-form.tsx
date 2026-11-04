"use client"

import { useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/phone-input"
import { EMAIL_ERROR, PHONE_ERROR, isLikelyMobile, normalizeEmail } from "@/lib/format"
import { submitInterest } from "./actions"

export function InterestForm({ slug, refCode }: { slug: string; refCode?: string }) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [city, setCity] = useState("")
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  if (done) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-xl bg-[#e1f6e8] p-5 text-[#14532d]">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
        <p className="font-medium">{done}</p>
      </div>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (name.trim().length < 2) return setError("Please enter your name.")
    if (!isLikelyMobile(phone)) return setError(PHONE_ERROR)
    if (normalizeEmail(email) === "invalid") return setError(EMAIL_ERROR)
    setBusy(true)
    const res = await submitInterest({ slug, ref: refCode, name, phone, email, city, consent, website })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setDone(
      res.referrerFirstName
        ? `Thanks! ${res.referrerFirstName} from Azisly.ai will reach out shortly.`
        : "Thanks! The Azisly.ai team will reach out shortly."
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="int-name">Your name</Label>
        <Input id="int-name" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="int-phone">WhatsApp number</Label>
        <PhoneInput id="int-phone" value={phone} onChange={setPhone} className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="int-email">Email (optional)</Label>
        <Input
          id="int-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="int-city">City</Label>
        <Input id="int-city" autoComplete="address-level2" maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} className="h-11" />
      </div>
      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      <label className="flex items-start gap-2.5 text-sm">
        <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
        I agree to be contacted by Azisly.ai about this course.
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="h-12 w-full rounded-full text-base" disabled={!consent || busy}>
        {busy ? "Sending…" : "I’m interested"}
      </Button>
    </form>
  )
}
