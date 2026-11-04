"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { RESERVED_SLUGS, type ActionResult } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

const optionalUrl = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), "Links must start with http:// or https://")

const courseSchema = z.object({
  name: z.string().trim().min(2, "Course name must be 2–120 characters.").max(120, "Course name must be 2–120 characters."),
  short_name: z.string().trim().min(2, "Short name must be 2–30 characters.").max(30, "Short name must be 2–30 characters."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Page address: lowercase letters, digits and dashes only.")
    .refine((s) => !RESERVED_SLUGS.has(s), "That page address is used by the app. Pick another."),
  one_line_value: z.string().trim().max(160, "One-line value: keep it under 160 characters."),
  offer_price: z.number({ message: "Enter the offer price." }).min(0, "Price can’t be negative."),
  original_price: z.number().min(0, "Price can’t be negative.").nullable(),
  typical_close: z.string().trim().max(40),
  tier: z.enum(["Entry", "Core", "Premium"]),
  who_for: z.string().trim().max(1000),
  what_they_get: z
    .array(z.string().trim().max(200))
    .transform((items) => items.filter(Boolean))
    .refine((items) => items.length <= 6, "Up to 6 points in What they get."),
  proof: z.string().trim().max(1000),
  pitch: z.string().trim().max(2000),
  objections: z
    .array(z.object({ q: z.string().trim().max(300), a: z.string().trim().max(1500) }))
    .transform((items) => items.filter((o) => o.q || o.a))
    .refine((items) => items.every((o) => o.q && o.a), "Each objection needs both a question and an answer."),
  brochure_url: optionalUrl,
  payment_url: optionalUrl,
  installments_allowed: z.boolean(),
  active: z.boolean(),
})

export async function saveCourse(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const parsed = courseSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const query = id
    ? supabase.from("courses").update(parsed.data).eq("id", id).select("id").single()
    : supabase.from("courses").insert(parsed.data).select("id").single()
  const { data, error } = await query
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Another course already uses that page address." }
    return { ok: false, error: error.message }
  }
  revalidatePath("/admin/courses")
  return { ok: true, data: { id: data.id } }
}

export async function setCourseActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from("courses").update({ active }).eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/courses")
  return { ok: true }
}
