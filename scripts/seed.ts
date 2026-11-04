// Fills a fresh database with the starting data from the spec (section 9.5).
// Safe to run more than once: existing rows are left alone.
// Usage: npm run db:seed
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

config({ path: ".env.local" })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase()
const adminName = process.env.ADMIN_NAME || "Sanjeet"

const TBD = "[To be filled in by admin]"

type SeedCourse = { name: string; short_name: string; slug: string; offer_price: number; original_price: number | null; typical_close: string; tier: string; sort_order: number }

const COURSES = ([
  {
    name: "AI Corporate Analyst Program", short_name: "AI Analyst", slug: "ai-corporate-analyst",
    offer_price: 2500, original_price: 5894, typical_close: "2–5 days", tier: "Entry", sort_order: 1,
  },
  {
    name: "TIFxAzisly – AI in Entrepreneurship", short_name: "TIFxAzisly", slug: "tif-ai-in-entrepreneurship",
    offer_price: 7000, original_price: 11800, typical_close: "1–2 weeks", tier: "Core", sort_order: 2,
  },
  {
    name: "TIF [full course name TBD]", short_name: "TIF Premium", slug: "tif-premium",
    offer_price: 50000, original_price: null, typical_close: "[TBD]", tier: "Premium", sort_order: 3,
  },
  {
    name: "Sure Shot / Sure Job Ready [confirm name]", short_name: "Sure Shot", slug: "sure-shot-job-ready",
    offer_price: 150000, original_price: null, typical_close: "3–6 weeks", tier: "Premium", sort_order: 4,
  },
] as SeedCourse[]).map((c) => ({ ...c, who_for: TBD, proof: TBD, pitch: TBD, what_they_get: [], objections: [], one_line_value: "" }))

const PODS = [
  { name: "Sample Pod Alpha", colour: "#2346F5" },
  { name: "Sample Pod Beta", colour: "#10B981" },
]

const SAMPLE_INTERNS = [
  { email: "sample.riya@example.com", full_name: "Riya Sample", pod: "Sample Pod Alpha", leader: true },
  { email: "sample.arjun@example.com", full_name: "Arjun Sample", pod: "Sample Pod Alpha", leader: false },
  { email: "sample.meera@example.com", full_name: "Meera Sample", pod: "Sample Pod Beta", leader: false },
]

async function main() {
  if (!url || !serviceKey) throw new Error("Supabase URL / service role key missing in .env.local")
  if (!adminEmail) throw new Error("ADMIN_EMAIL missing in .env.local")
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  async function ensureUser(email: string, full_name: string, role: "admin" | "intern", pod_id: string | null) {
    const { data: existing } = await db.from("profiles").select("id").eq("email", email).maybeSingle()
    if (existing) return existing.id as string
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name } })
    if (error) throw new Error(`Creating ${email}: ${error.message}`)
    const { error: pErr } = await db.from("profiles").insert({ id: data.user.id, email, full_name, role, pod_id })
    if (pErr) throw new Error(`Profile for ${email}: ${pErr.message}`)
    await db.from("invites").upsert({ email, full_name, role, pod_id }, { onConflict: "email" })
    console.log(`  + ${role} ${email}`)
    return data.user.id
  }

  console.log("Courses")
  for (const c of COURSES) {
    const { data } = await db.from("courses").select("id").eq("slug", c.slug).maybeSingle()
    if (data) continue
    const { error } = await db.from("courses").insert(c)
    if (error) throw new Error(`Course ${c.name}: ${error.message}`)
    console.log(`  + ${c.name}`)
  }

  console.log("Settings")
  await db.from("settings").upsert({ id: 1 }, { onConflict: "id", ignoreDuplicates: true })

  console.log("Admin")
  await ensureUser(adminEmail, adminName, "admin", null)

  console.log("Sample pods and interns")
  const podIds: Record<string, string> = {}
  for (const p of PODS) {
    const { data } = await db.from("pods").select("id").eq("name", p.name).maybeSingle()
    if (data) podIds[p.name] = data.id
    else {
      const { data: created, error } = await db.from("pods").insert(p).select("id").single()
      if (error) throw new Error(`Pod ${p.name}: ${error.message}`)
      podIds[p.name] = created.id
      console.log(`  + pod ${p.name}`)
    }
  }
  for (const i of SAMPLE_INTERNS) {
    const id = await ensureUser(i.email, i.full_name, "intern", podIds[i.pod])
    if (i.leader) await db.from("pods").update({ leader_id: id }).eq("id", podIds[i.pod]).is("leader_id", null)
  }
  console.log("Seed complete.")
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
