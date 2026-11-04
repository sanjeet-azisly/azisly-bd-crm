import "server-only"
import { cache } from "react"
import { createAdminClient } from "@/lib/supabase/admin"

export type PublicCourse = {
  id: string
  name: string
  short_name: string
  slug: string
  one_line_value: string
  who_for: string
  what_they_get: string[]
  proof: string
  offer_price: number
  original_price: number | null
}

// Prospects aren't logged in, so the server reads just these public fields.
// Internal fields (pitch, objections, payment link) never reach this page.
export const getPublicCourse = cache(async (slug: string): Promise<PublicCourse | null> => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null
  const { data } = await createAdminClient()
    .from("courses")
    .select("id, name, short_name, slug, one_line_value, who_for, what_they_get, proof, offer_price, original_price")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle()
  return data ? { ...data, offer_price: Number(data.offer_price), original_price: data.original_price === null ? null : Number(data.original_price) } : null
})

/** The intern a ?ref= code belongs to (active team members only). */
export const getReferrer = cache(async (ref: string | undefined) => {
  if (!ref || !/^[A-Za-z0-9]{3,20}$/.test(ref)) return null
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, full_name")
    .eq("referral_code", ref)
    .eq("active", true)
    .maybeSingle()
  return data
})
