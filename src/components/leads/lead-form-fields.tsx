"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { PhoneInput } from "@/components/phone-input"
import { EMAIL_ERROR, PHONE_ERROR, isLikelyMobile, normalizeEmail } from "@/lib/format"
import { PERSONAS, SOURCES } from "@/lib/leads"

export type CourseOption = { id: string; short_name: string; name: string }

export type LeadFormValues = {
  name: string
  phone: string
  email: string
  persona: string
  college: string
  city: string
  source: string
  course_id: string
}

export const emptyLeadForm: LeadFormValues = {
  name: "",
  phone: "",
  email: "",
  persona: "",
  college: "",
  city: "",
  source: "",
  course_id: "",
}

/** Checks the form the same way the server does, so mistakes show instantly. */
export function validateLeadForm(v: LeadFormValues): string | null {
  const name = v.name.trim()
  if (name.length < 2 || name.length > 80) return "Name must be 2–80 characters."
  if (!isLikelyMobile(v.phone)) return PHONE_ERROR
  if (normalizeEmail(v.email) === "invalid") return EMAIL_ERROR
  if (!v.source) return "Pick where this lead came from."
  return null
}

export function leadPayload(v: LeadFormValues) {
  return {
    name: v.name,
    phone: v.phone,
    email: v.email,
    persona: v.persona || null,
    college: v.college,
    city: v.city,
    source: v.source,
    course_id: v.course_id || null,
  }
}

export function LeadFormFields({
  values,
  onChange,
  courses,
}: {
  values: LeadFormValues
  onChange: (v: LeadFormValues) => void
  courses: CourseOption[]
}) {
  const set = (k: keyof LeadFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...values, [k]: e.target.value })
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="lead-name">Name</Label>
        <Input id="lead-name" value={values.name} maxLength={80} onChange={set("name")} autoComplete="off" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-phone">WhatsApp number</Label>
        <PhoneInput id="lead-phone" value={values.phone} onChange={(phone) => onChange({ ...values, phone })} autoComplete="off" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-email">Email (optional)</Label>
        <Input
          id="lead-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          maxLength={254}
          placeholder="name@example.com"
          value={values.email}
          onChange={set("email")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-persona">Persona</Label>
        <NativeSelect id="lead-persona" value={values.persona} onChange={set("persona")}>
          <option value="">Pick one</option>
          {PERSONAS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-college">College / company (optional)</Label>
        <Input id="lead-college" value={values.college} maxLength={120} onChange={set("college")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-city">City (optional)</Label>
        <Input id="lead-city" value={values.city} maxLength={80} onChange={set("city")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-source">Source</Label>
        <NativeSelect id="lead-source" value={values.source} onChange={set("source")}>
          <option value="">Pick one</option>
          {SOURCES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-course">Interested in</Label>
        <NativeSelect id="lead-course" value={values.course_id} onChange={set("course_id")}>
          <option value="">Not sure yet</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  )
}
