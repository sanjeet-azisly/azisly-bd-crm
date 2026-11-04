// Adds clearly marked sample leads for the sample interns, so screens have something to show.
// Remove them all with: npm run db:sample-leads -- --remove
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

config({ path: ".env.local", quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

// Sample phone numbers all start 9000001… so they're easy to find and remove.
const PREFIX = "9000001"

function istToday(offsetDays = 0) {
  const d = new Date(Date.now() + 330 * 60_000 + offsetDays * 86_400_000)
  return d.toISOString().slice(0, 10)
}

const LEADS = [
  { owner: "arjun", name: "Kavya Rao (sample)", stage: "New", bant: 1, follow: 0, source: "Campus", course: "ai-corporate-analyst" },
  { owner: "arjun", name: "Rohan Gupta (sample)", stage: "New", bant: 0, follow: 1, source: "LinkedIn", course: null },
  { owner: "arjun", name: "Ananya Das (sample)", stage: "Talking", bant: 2, follow: -2, source: "WhatsApp", course: "ai-corporate-analyst", touches: 2 },
  { owner: "arjun", name: "Vikram Singh (sample)", stage: "Talking", bant: 3, follow: 0, source: "Alumni", course: "tif-ai-in-entrepreneurship", touches: 1 },
  { owner: "arjun", name: "Sneha Pillai (sample)", stage: "Talking", bant: 4, follow: 0, source: "Referral", course: "tif-ai-in-entrepreneurship", touches: 3 },
  { owner: "arjun", name: "Farhan Ali (sample)", stage: "Talking", bant: 3, follow: 2, source: "Webinar", course: "ai-corporate-analyst", touches: 4 },
  { owner: "arjun", name: "Ishita Jain (sample)", stage: "Demo done", bant: 4, follow: -1, source: "Fests & events", course: "tif-premium", touches: 5 },
  { owner: "arjun", name: "Parent of Aditya (sample)", stage: "Demo done", bant: 3, follow: 0, source: "Campus", course: "sure-shot-job-ready", touches: 7 },
  { owner: "arjun", name: "Meghna Roy (sample)", stage: "Payment pending", bant: 4, follow: 1, source: "Instagram", course: "ai-corporate-analyst", touches: 6 },
  { owner: "arjun", name: "Karan Mehta (sample)", stage: "Nurture", bant: 1, follow: 14, source: "Campus", course: "tif-premium", touches: 4 },
  { owner: "arjun", name: "Pooja Nair (sample)", stage: "Lost", bant: 0, follow: null, source: "LinkedIn", course: "sure-shot-job-ready", touches: 7, lost: "Price" },
  { owner: "meera", name: "Rahul Verma (sample)", stage: "Talking", bant: 2, follow: 0, source: "Campus", course: "ai-corporate-analyst", touches: 1 },
  { owner: "meera", name: "Tanvi Shah (sample)", stage: "Talking", bant: 4, follow: -1, source: "Referral", course: "tif-ai-in-entrepreneurship", touches: 2 },
] as const

async function main() {
  const { data: old } = await db.from("leads").select("id").like("phone", `${PREFIX}%`)
  const oldIds = (old ?? []).map((l) => l.id)
  if (oldIds.length) {
    await db.from("payments").delete().in("lead_id", oldIds)
    await db.from("help_requests").delete().in("lead_id", oldIds)
    for (const id of oldIds) await db.from("notifications").delete().eq("link", `/leads/${id}`)
  }
  const { error: delErr } = await db.from("leads").delete().like("phone", `${PREFIX}%`)
  if (delErr) throw delErr
  if (process.argv.includes("--remove")) return console.log("Sample leads removed.")

  const { data: people } = await db.from("profiles").select("id, email")
  const owner = (who: string) => people!.find((p) => p.email === `sample.${who}@example.com`)?.id
  const { data: courses } = await db.from("courses").select("id, slug")
  const course = (slug: string | null) => (slug ? courses!.find((c) => c.slug === slug)?.id ?? null : null)

  const rows = LEADS.map((l, i) => {
    const flags = [false, false, false, false].map((_, k) => k < l.bant)
    return {
      owner_id: owner(l.owner),
      name: l.name,
      phone: `${PREFIX}${String(i).padStart(3, "0")}`,
      source: l.source,
      course_id: course(l.course),
      bant_b: flags[0],
      bant_a: flags[1],
      bant_n: flags[2],
      bant_t: flags[3],
      stage: l.stage,
      lost_reason: "lost" in l ? l.lost : null,
      next_follow_up: l.follow === null ? null : istToday(l.follow),
    }
  })
  const { data, error } = await db.from("leads").insert(rows).select("id, phone")
  if (error) throw error
  // Touches are normally counted by logging them; set the sample counts directly.
  for (const [i, l] of LEADS.entries()) {
    if ("touches" in l) {
      const id = data!.find((d) => d.phone === rows[i].phone)!.id
      await db.from("leads").update({ touches: l.touches, last_touched_at: new Date().toISOString() }).eq("id", id)
    }
  }
  // Two verified sample sales so the meter and leaderboards have something to show.
  const sales = [
    { name: "Ishita Jain (sample)", amount: 50000, txn: "SAMPLE-TXN-1" },
    { name: "Tanvi Shah (sample)", amount: 7000, txn: "SAMPLE-TXN-2" },
  ]
  for (const sale of sales) {
    const i = LEADS.findIndex((l) => l.name === sale.name)
    const id = data!.find((d) => d.phone === rows[i].phone)!.id
    const { data: pay, error: payErr } = await db
      .from("payments")
      .insert({ lead_id: id, amount: sale.amount, paid_on: istToday(0), txn_ref: sale.txn })
      .select("id")
      .single()
    if (payErr) throw payErr
    await db.from("payments").update({ status: "Verified" }).eq("id", pay.id)
  }
  // Two leads nobody has touched for 4 days, so the pool has something in it.
  const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000).toISOString()
  for (const name of ["Ananya Das (sample)", "Rohan Gupta (sample)"]) {
    const i = LEADS.findIndex((l) => l.name === name)
    const id = data!.find((d) => d.phone === rows[i].phone)!.id
    await db.from("leads").update({ last_touched_at: fourDaysAgo, assigned_at: fourDaysAgo }).eq("id", id)
  }

  // One open help request (only works if the owner's pod has a leader).
  {
    const i = LEADS.findIndex((l) => l.name === "Parent of Aditya (sample)")
    const id = data!.find((d) => d.phone === rows[i].phone)!.id
    const { error: helpErr } = await db.from("help_requests").insert({
      lead_id: id,
      requested_by: rows[i].owner_id,
      reason: "Parent call",
      note: "Father wants to talk about the course outcomes before paying.",
    })
    if (helpErr) console.log(`(No sample help request: ${helpErr.message})`)
  }
  console.log(`Added ${rows.length} sample leads and ${sales.length} verified sample payments.`)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
