// Demo accounts for trying each role: Demo Admin, Demo Manager, Demo Intern (in "Demo Pod"),
// with a few demo leads and one pending payment. Safe to run again.
// Usage:  npm run db:demo            (create)
//         npm run db:demo -- --remove (delete all demo data)
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

config({ path: ".env.local", quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const POD = { name: "Demo Pod", colour: "#8B5CF6" }
const PEOPLE = [
  { key: "admin", email: "demo.admin@example.com", full_name: "Demo Admin", phone: "9123400001", role: "admin", inPod: false },
  { key: "leader", email: "demo.leader@example.com", full_name: "Demo Manager", phone: "9123400002", role: "manager", inPod: true },
  { key: "intern", email: "demo.intern@example.com", full_name: "Demo Intern", phone: "9123400003", role: "intern", inPod: true },
] as const

// Demo lead phones all start 9000003… so they're easy to find and remove.
const LEADS = [
  { owner: "intern", name: "Aisha Khan (demo)", phone: "9000003001", stage: "New", bant: 1, source: "Campus", course: "ai-corporate-analyst", follow: 0 },
  { owner: "intern", name: "Dev Patel (demo)", phone: "9000003002", stage: "Talking", bant: 3, source: "LinkedIn", course: "tif-ai-in-entrepreneurship", follow: -1, touches: 2 },
  { owner: "intern", name: "Nisha Menon (demo)", phone: "9000003003", stage: "Demo done", bant: 4, source: "Referral", course: "ai-corporate-analyst", follow: 1, touches: 4, pay: 2500 },
  { owner: "leader", name: "Kabir Joshi (demo)", phone: "9000003004", stage: "Talking", bant: 2, source: "Alumni", course: "tif-premium", follow: 0, touches: 1 },
  { owner: "leader", name: "Parent of Zoya (demo)", phone: "9000003005", stage: "Demo done", bant: 3, source: "Fests & events", course: "sure-shot-job-ready", follow: 2, touches: 3 },
] as const

const istDay = (offset: number) => new Date(Date.now() + 330 * 60_000 + offset * 86_400_000).toISOString().slice(0, 10)

async function removeAll() {
  const { data: leads } = await db.from("leads").select("id").like("phone", "9000003%")
  const ids = (leads ?? []).map((l) => l.id)
  if (ids.length) {
    await db.from("payments").delete().in("lead_id", ids)
    await db.from("help_requests").delete().in("lead_id", ids)
    for (const id of ids) await db.from("notifications").delete().eq("link", `/leads/${id}`)
    await db.from("leads").delete().in("id", ids)
  }
  for (const p of PEOPLE) {
    const { data } = await db.from("profiles").select("id").eq("email", p.email).maybeSingle()
    if (data) await db.auth.admin.deleteUser(data.id)
    await db.from("invites").delete().eq("email", p.email)
  }
  await db.from("pods").delete().eq("name", POD.name)
}

async function main() {
  await removeAll()
  if (process.argv.includes("--remove")) return console.log("Demo accounts and demo leads removed.")

  const { data: pod, error: podErr } = await db.from("pods").insert(POD).select("id").single()
  if (podErr) throw podErr

  const ids: Record<string, string> = {}
  for (const p of PEOPLE) {
    const { data, error } = await db.auth.admin.createUser({ email: p.email, email_confirm: true, user_metadata: { full_name: p.full_name } })
    if (error) throw new Error(`${p.email}: ${error.message}`)
    ids[p.key] = data.user.id
    const { error: pErr } = await db.from("profiles").insert({
      id: data.user.id,
      email: p.email,
      full_name: p.full_name,
      phone: p.phone,
      role: p.role,
      pod_id: p.inPod ? pod.id : null,
      permissions: p.role === "manager" ? ["manage_team", "export", "flags", "approve_payments"] : [],
      commission_pct: p.role === "manager" ? 5 : null,
    })
    if (pErr) throw new Error(`${p.email}: ${pErr.message}`)
    await db.from("invites").upsert({ email: p.email, full_name: p.full_name, phone: p.phone, role: p.role, pod_id: p.inPod ? pod.id : null, make_leader: p.key === "leader" }, { onConflict: "email" })
  }
  await db.from("pods").update({ leader_id: ids.leader }).eq("id", pod.id)

  const { data: courses } = await db.from("courses").select("id, slug")
  const courseId = (slug: string) => courses?.find((c) => c.slug === slug)?.id ?? null
  for (const l of LEADS) {
    const flags = [0, 1, 2, 3].map((k) => k < l.bant)
    const { data: lead, error } = await db
      .from("leads")
      .insert({
        owner_id: ids[l.owner],
        name: l.name,
        phone: l.phone,
        source: l.source,
        course_id: courseId(l.course),
        bant_b: flags[0],
        bant_a: flags[1],
        bant_n: flags[2],
        bant_t: flags[3],
        stage: l.stage,
        next_follow_up: istDay(l.follow),
      })
      .select("id")
      .single()
    if (error) throw new Error(`${l.name}: ${error.message}`)
    if ("touches" in l) await db.from("leads").update({ touches: l.touches, last_touched_at: new Date().toISOString() }).eq("id", lead.id)
    if ("pay" in l) {
      // A pending payment, so the admin's Verify queue has something to try.
      const { error: payErr } = await db.from("payments").insert({ lead_id: lead.id, amount: l.pay, paid_on: istDay(0), txn_ref: `DEMO-UPI-${l.phone}` })
      if (payErr) throw new Error(`payment: ${payErr.message}`)
    }
  }
  console.log("Created: Demo Admin, Demo Manager, Demo Intern (Demo Pod), 5 demo leads, 1 pending payment.")
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
