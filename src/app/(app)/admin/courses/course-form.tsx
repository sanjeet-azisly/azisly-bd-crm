"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { slugify } from "@/lib/format"
import type { Course, CourseTier, Objection } from "@/lib/types"
import { saveCourse } from "./actions"

function parseRupees(v: string): number | null | "bad" {
  const clean = v.replace(/[,\s₹]/g, "")
  if (!clean) return null
  return /^\d+$/.test(clean) ? Number(clean) : "bad"
}

export function CourseForm({ course }: { course: Course | null }) {
  const router = useRouter()
  const [name, setName] = useState(course?.name ?? "")
  const [shortName, setShortName] = useState(course?.short_name ?? "")
  const [slug, setSlug] = useState(course?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(!!course)
  const [oneLine, setOneLine] = useState(course?.one_line_value ?? "")
  const [offer, setOffer] = useState(course ? String(course.offer_price) : "")
  const [original, setOriginal] = useState(course?.original_price != null ? String(course.original_price) : "")
  const [close, setClose] = useState(course?.typical_close ?? "")
  const [tier, setTier] = useState<CourseTier>(course?.tier ?? "Core")
  const [whoFor, setWhoFor] = useState(course?.who_for ?? "")
  const [gets, setGets] = useState<string[]>(course?.what_they_get?.length ? course.what_they_get : [""])
  const [proof, setProof] = useState(course?.proof ?? "")
  const [pitch, setPitch] = useState(course?.pitch ?? "")
  const [objections, setObjections] = useState<Objection[]>(course?.objections?.length ? course.objections : [{ q: "", a: "" }])
  const [brochure, setBrochure] = useState(course?.brochure_url ?? "")
  const [payment, setPayment] = useState(course?.payment_url ?? "")
  const [installments, setInstallments] = useState(course?.installments_allowed ?? false)
  const [active, setActive] = useState(course?.active ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const offerPrice = parseRupees(offer)
    const originalPrice = parseRupees(original)
    if (offerPrice === null || offerPrice === "bad") return setError("Enter the offer price as a whole number of rupees.")
    if (originalPrice === "bad") return setError("Enter the original price as a whole number of rupees.")
    setBusy(true)
    const res = await saveCourse(course?.id ?? null, {
      name,
      short_name: shortName,
      slug,
      one_line_value: oneLine,
      offer_price: offerPrice,
      original_price: originalPrice,
      typical_close: close,
      tier,
      who_for: whoFor,
      what_they_get: gets,
      proof,
      pitch,
      objections,
      brochure_url: brochure,
      payment_url: payment,
      installments_allowed: installments,
      active,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    toast.success(course ? "Course saved" : "Course added")
    router.push("/admin/courses")
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-6 pb-4" noValidate>
      <Section title="Basics">
        <Field label="Course name" htmlFor="c-name">
          <Input
            id="c-name"
            value={name}
            maxLength={120}
            onChange={(e) => {
              setName(e.target.value)
              if (!slugTouched) setSlug(slugify(e.target.value))
            }}
          />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Short name (shown in lists)" htmlFor="c-short">
            <Input id="c-short" value={shortName} maxLength={30} onChange={(e) => setShortName(e.target.value)} />
          </Field>
          <Field label="Public page address" htmlFor="c-slug" hint={`Prospects will open /${slug || "course-name"}?ref=CODE`}>
            <Input
              id="c-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }}
            />
          </Field>
        </div>
        <Field label="One-line value" htmlFor="c-oneline" hint="Used in the WhatsApp share message and on the public page.">
          <Input id="c-oneline" value={oneLine} maxLength={160} onChange={(e) => setOneLine(e.target.value)} />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Offer price (₹)" htmlFor="c-offer">
            <Input id="c-offer" inputMode="numeric" value={offer} onChange={(e) => setOffer(e.target.value)} />
          </Field>
          <Field label="Original price (₹, optional)" htmlFor="c-orig">
            <Input id="c-orig" inputMode="numeric" value={original} onChange={(e) => setOriginal(e.target.value)} />
          </Field>
          <Field label="Typical close time" htmlFor="c-close">
            <Input id="c-close" placeholder="e.g. 2–5 days" value={close} maxLength={40} onChange={(e) => setClose(e.target.value)} />
          </Field>
          <Field label="Tier" htmlFor="c-tier">
            <NativeSelect id="c-tier" value={tier} onChange={(e) => setTier(e.target.value as CourseTier)}>
              <option>Entry</option>
              <option>Core</option>
              <option>Premium</option>
            </NativeSelect>
          </Field>
        </div>
      </Section>

      <Section title="Value (what interns explain)">
        <Field label="Who it’s for" htmlFor="c-who">
          <Textarea id="c-who" rows={3} value={whoFor} onChange={(e) => setWhoFor(e.target.value)} />
        </Field>
        <div className="space-y-2">
          <Label>What they get (up to 6 points)</Label>
          {gets.map((g, i) => (
            <div key={i} className="flex gap-2">
              <Input
                aria-label={`Point ${i + 1}`}
                value={g}
                maxLength={200}
                onChange={(e) => setGets(gets.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove point ${i + 1}`}
                onClick={() => setGets(gets.length > 1 ? gets.filter((_, j) => j !== i) : [""])}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {gets.length < 6 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setGets([...gets, ""])}>
              <Plus /> Add point
            </Button>
          )}
        </div>
        <Field label="Proof (partner, certificate, outcomes)" htmlFor="c-proof">
          <Textarea id="c-proof" rows={3} value={proof} onChange={(e) => setProof(e.target.value)} />
        </Field>
      </Section>

      <Section title="Selling">
        <Field label="60-second pitch" htmlFor="c-pitch">
          <Textarea id="c-pitch" rows={5} value={pitch} onChange={(e) => setPitch(e.target.value)} />
        </Field>
        <div className="space-y-3">
          <Label>Objections</Label>
          {objections.map((o, i) => (
            <div key={i} className="space-y-2 rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Objection {i + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove objection ${i + 1}`}
                  onClick={() => setObjections(objections.length > 1 ? objections.filter((_, j) => j !== i) : [{ q: "", a: "" }])}
                >
                  <Trash2 />
                </Button>
              </div>
              <Input
                placeholder="What the prospect says, e.g. “It’s too expensive”"
                aria-label={`Objection ${i + 1} question`}
                value={o.q}
                onChange={(e) => setObjections(objections.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
              />
              <Textarea
                placeholder="How to answer"
                aria-label={`Objection ${i + 1} answer`}
                rows={2}
                value={o.a}
                onChange={(e) => setObjections(objections.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
              />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setObjections([...objections, { q: "", a: "" }])}>
            <Plus /> Add objection
          </Button>
        </div>
      </Section>

      <Section title="Links and payment">
        <Field label="Brochure link" htmlFor="c-brochure">
          <Input id="c-brochure" type="url" placeholder="https://" value={brochure} onChange={(e) => setBrochure(e.target.value)} />
        </Field>
        <Field label="Official payment link" htmlFor="c-pay" hint="The only link interns share for payment.">
          <Input id="c-pay" type="url" placeholder="https://" value={payment} onChange={(e) => setPayment(e.target.value)} />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={installments} onCheckedChange={setInstallments} /> Installments allowed
        </label>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={active} onCheckedChange={setActive} /> Active (visible to interns and prospects)
        </label>
      </Section>

      {error && (
        <p role="alert" className="rounded-xl bg-[#fdecea] px-4 py-3 text-sm text-[#b42318]">
          {error}
        </p>
      )}
      <div className="sticky bottom-16 flex gap-2 rounded-xl border bg-white/90 p-3 shadow-lg backdrop-blur md:bottom-4">
        <Button type="submit" className="h-10 flex-1 sm:flex-none" disabled={busy}>
          {busy ? "Saving…" : course ? "Save course" : "Add course"}
        </Button>
        <Link href="/admin/courses" className={buttonVariants({ variant: "outline", className: "h-10" })}>
          Cancel
        </Link>
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6 rounded-2xl bg-surface p-6">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
