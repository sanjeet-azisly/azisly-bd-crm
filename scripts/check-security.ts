// Checks the database rules (row level security) from each role's point of view.
// Uses the sample accounts from the seed. Usage: npm run db:check
import { config } from "dotenv"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

config({ path: ".env.local" })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

let failures = 0
function check(name: string, pass: boolean, detail = "") {
  if (!pass) failures++
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail && !pass ? `  (${detail})` : ""}`)
}

/** Signs in as a team member without sending an email. */
async function signInAs(email: string): Promise<SupabaseClient> {
  const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email })
  if (error) throw new Error(`generateLink ${email}: ${error.message}`)
  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const { error: vErr } = await client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" })
  if (vErr) throw new Error(`verify ${email}: ${vErr.message}`)
  return client
}

async function run() {
  const intern = await signInAs("sample.arjun@example.com")
  const admin = await signInAs(process.env.ADMIN_EMAIL!)
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data: arjun } = await service.from("profiles").select("id, pod_id").eq("email", "sample.arjun@example.com").single()
  const { data: meera } = await service.from("profiles").select("id, pod_id").eq("email", "sample.meera@example.com").single()

  // Intern
  const { data: teamRows } = await intern.from("profiles").select("id")
  check("Intern can see team names (for leaderboards)", (teamRows?.length ?? 0) >= 4)
  const { data: inv } = await intern.from("invites").select("id")
  check("Intern cannot read invites", (inv?.length ?? 0) === 0)
  const { error: roleErr } = await intern.from("profiles").update({ role: "admin" }).eq("id", arjun!.id)
  check("Intern cannot make themselves admin", !!roleErr)
  const { error: codeErr } = await intern.from("profiles").update({ referral_code: "Hacker99" }).eq("id", arjun!.id)
  check("Intern cannot change their referral code", !!codeErr)
  const { data: otherUpd } = await intern.from("profiles").update({ full_name: "Changed" }).eq("id", meera!.id).select()
  check("Intern cannot edit someone else", (otherUpd?.length ?? 0) === 0)
  const { error: podErr } = await intern.from("pods").insert({ name: "Intern pod" })
  check("Intern cannot create pods", !!podErr)
  const { data: courseUpd } = await intern.from("courses").update({ offer_price: 1 }).neq("id", "00000000-0000-0000-0000-000000000000").select()
  check("Intern cannot change course prices", (courseUpd?.length ?? 0) === 0)
  const { data: setUpd } = await intern.from("settings").update({ pool_hours: 1 }).eq("id", 1).select()
  check("Intern cannot change settings", (setUpd?.length ?? 0) === 0)
  const { data: courses } = await intern.from("courses").select("id, active")
  check("Intern sees only active courses", (courses ?? []).every((c) => c.active))

  const { data: claimed, error: claimErr } = await intern.rpc("claim_first_login")
  check("Intern gets a referral code on first login", !claimErr && !!claimed?.referral_code, claimErr?.message)
  const { error: codeAgain } = await intern.from("profiles").update({ referral_code: "Hacker98" }).eq("id", arjun!.id)
  check("…but still can't change it themselves afterwards", !!codeAgain)

  // Prospect (not logged in)
  const { data: anonCourses } = await anon.from("courses").select("id")
  check("Logged-out visitors can't read tables directly", (anonCourses?.length ?? 0) === 0)
  const { data: anonProfiles } = await anon.from("profiles").select("id")
  check("Logged-out visitors can't see the team", (anonProfiles?.length ?? 0) === 0)

  // Admin
  const { data: adminInv } = await admin.from("invites").select("id")
  check("Admin can read invites", (adminInv?.length ?? 0) >= 4)
  const { error: leaderErr } = await admin.from("pods").update({ leader_id: meera!.id }).eq("id", arjun!.pod_id!)
  check("A pod leader must be a member of that pod", !!leaderErr)

  // Only invited emails
  const { error: otpErr } = await anon.auth.signInWithOtp({
    email: "not.invited.person@example.com",
    options: { shouldCreateUser: false },
  })
  check("Uninvited email can't get a login link", !!otpErr, otpErr?.message)
  const { data: su, error: suErr } = await anon.auth.signUp({ email: "not.invited.signup@example.com", password: "Xy9!" + Date.now() })
  check("Open sign-ups are switched off", !!suErr, "Turn OFF 'Allow new users to sign up' in Supabase")
  if (su?.user && !suErr) await service.auth.admin.deleteUser(su.user.id)

  // Leads (phase 2). Test numbers are cleaned up before and after.
  const TEST_PHONES = ["9000000001", "9000000002"]
  await cleanupTestLeads(TEST_PHONES)
  const { data: riya } = await service.from("profiles").select("id").eq("email", "sample.riya@example.com").single()
  const leader = await signInAs("sample.riya@example.com")
  const other = await signInAs("sample.meera@example.com")

  const { data: lead, error: addErr } = await intern
    .from("leads")
    .insert({ name: "Test Lead", phone: TEST_PHONES[0], source: "Campus" })
    .select("id, owner_id, pod_id, temperature, stage")
    .single()
  check("Intern can add their own lead", !addErr && lead?.owner_id === arjun!.id, addErr?.message)
  check("New lead goes into the owner's pod", lead?.pod_id === arjun!.pod_id)
  check("New lead with no BANT is Cold", lead?.temperature === "Cold")

  const { error: forOtherErr } = await intern
    .from("leads")
    .insert({ name: "Sneaky", phone: TEST_PHONES[1], source: "Campus", owner_id: meera!.id })
  check("Intern cannot add a lead for someone else", !!forOtherErr)

  const { error: dupErr } = await other.from("leads").insert({ name: "Dup", phone: TEST_PHONES[0], source: "Campus" })
  check("The same number can't be added twice (anyone)", dupErr?.code === "23505", dupErr?.message)
  // Flagging the blocked duplicate (what Add lead does) – logged once per hour per person.
  await other.rpc("log_duplicate_attempt", { p_phone: TEST_PHONES[0], p_name: "Dup", p_email: null, p_via: "add_lead" })
  await other.rpc("log_duplicate_attempt", { p_phone: TEST_PHONES[0], p_name: "Dup again", p_email: null, p_via: "add_lead" })
  const { data: flags } = await admin.from("duplicate_attempts").select("attempted_by, via").eq("lead_id", lead!.id)
  check("A blocked duplicate is flagged for the admin (once per hour)", flags?.length === 1 && flags[0].attempted_by === meera!.id)
  const { data: internFlags } = await other.from("duplicate_attempts").select("id")
  check("Interns can't see the flagged list", (internFlags?.length ?? 0) === 0)
  const { error: fakeFlag } = await other.from("duplicate_attempts").insert({ lead_id: lead!.id, phone: TEST_PHONES[0], via: "add_lead" })
  check("Interns can't write flags directly", !!fakeFlag)
  const { data: dismissed } = await other.from("duplicate_attempts").update({ dismissed_at: new Date().toISOString() }).eq("lead_id", lead!.id).select()
  check("Interns can't dismiss flags", (dismissed?.length ?? 0) === 0)

  const { data: dupInfo } = await other.rpc("find_lead_by_phone", { p_phone: TEST_PHONES[0] })
  check(
    "Duplicate check names the owner but hides the lead from others",
    dupInfo?.[0]?.owner_name === "Arjun Sample" && dupInfo?.[0]?.lead_id === null
  )

  const { data: otherSees } = await other.from("leads").select("id").eq("id", lead!.id)
  check("Intern in another pod can't see the lead", (otherSees?.length ?? 0) === 0)
  const { data: otherLeadUpd } = await other.from("leads").update({ name: "Hacked" }).eq("id", lead!.id).select()
  check("Intern in another pod can't change the lead", (otherLeadUpd?.length ?? 0) === 0)
  const { data: leaderSees } = await leader.from("leads").select("id").eq("id", lead!.id)
  check("Pod leader can see their pod's lead", (leaderSees?.length ?? 0) === 1)
  const { data: anonLeads } = await anon.from("leads").select("id")
  check("Logged-out visitors can't read leads", (anonLeads?.length ?? 0) === 0)

  await intern.from("leads").update({ bant_b: true, bant_a: true, bant_n: true, bant_t: true }).eq("id", lead!.id)
  const { data: hot } = await intern.from("leads").select("temperature").eq("id", lead!.id).single()
  check("4 BANT yes makes the lead Hot", hot?.temperature === "Hot")

  const { error: wonErr } = await intern.from("leads").update({ stage: "Won" }).eq("id", lead!.id)
  check("Intern can't mark Won by hand", !!wonErr)
  const { error: lostErr } = await intern.from("leads").update({ stage: "Lost" }).eq("id", lead!.id)
  check("Lost needs a reason", !!lostErr)
  const { error: ownErr } = await intern.from("leads").update({ owner_id: meera!.id }).eq("id", lead!.id)
  check("Intern can't hand their lead to someone", !!ownErr)

  const { data: touched, error: touchErr } = await intern.rpc("log_touch", {
    p_lead: lead!.id,
    p_type: "call",
    p_note: "Spoke for 5 min",
    p_next: "2026-12-01",
  })
  check(
    "Logging a call adds a touch, sets follow-up and moves New → Talking",
    !touchErr && touched?.touches === 1 && touched?.next_follow_up === "2026-12-01" && touched?.stage === "Talking",
    touchErr?.message
  )
  const { data: outreach } = await intern.from("lead_events").select("counts_as").eq("lead_id", lead!.id).eq("type", "call")
  check("First call counts as outreach", outreach?.[0]?.counts_as === "outreach")
  const { error: otherTouch } = await other.rpc("log_touch", { p_lead: lead!.id, p_type: "call", p_note: "", p_next: null })
  check("Someone else can't log touches on the lead", !!otherTouch)

  const { error: crossPod } = await leader.from("leads").update({ owner_id: meera!.id }).eq("id", lead!.id)
  check("Pod leader can't move a lead outside the pod", !!crossPod)
  const { data: moved, error: inPod } = await leader.from("leads").update({ owner_id: riya!.id }).eq("id", lead!.id).select("id")
  check("Pod leader can reassign within the pod", !inPod && moved?.length === 1, inPod?.message)
  const { data: events } = await service.from("lead_events").select("type").eq("lead_id", lead!.id)
  const types = new Set((events ?? []).map((e) => e.type))
  check("Timeline records add, stage change, touch and reassignment", ["created", "stage_change", "call", "reassign"].every((t) => types.has(t)))

  // A demo moves the lead to Demo done; moving the owner to another pod takes their leads along.
  const { data: demo } = await leader.rpc("log_touch", { p_lead: lead!.id, p_type: "demo", p_note: "", p_next: null })
  check("Logging a demo moves the lead to Demo done", demo?.stage === "Demo done")
  await service.from("profiles").update({ pod_id: meera!.pod_id }).eq("id", riya!.id)
  const { data: followed } = await service.from("leads").select("pod_id").eq("id", lead!.id).single()
  check("When someone changes pod, their leads move with them", followed?.pod_id === meera!.pod_id)

  await paymentChecks({ intern, other, admin, anon, leadId: lead!.id, ownerId: riya!.id })
  await podChecks({ intern, other, leader, admin, arjunId: arjun!.id, riyaId: riya!.id, phone: TEST_PHONES[1] })
  await cleanupTestLeads(TEST_PHONES)
}

async function cleanupTestLeads(phones: string[]) {
  const { data: rows } = await service.from("leads").select("id").in("phone", phones)
  const ids = (rows ?? []).map((r) => r.id)
  if (ids.length) {
    await service.from("payments").delete().in("lead_id", ids)
    await service.from("help_requests").delete().in("lead_id", ids)
    for (const id of ids) await service.from("notifications").delete().eq("link", `/leads/${id}`)
  }
  await service.from("leads").delete().in("phone", phones)
}

/** Phase 5: help requests and the pool. Arjun + Riya (leader) share a pod; Meera is elsewhere. */
async function podChecks(c: {
  intern: SupabaseClient
  other: SupabaseClient
  leader: SupabaseClient
  admin: SupabaseClient
  arjunId: string
  riyaId: string
  phone: string
}) {
  // An earlier check moved Riya to another pod; put her back as this pod's leader.
  const { data: arjunNow } = await service.from("profiles").select("pod_id").eq("id", c.arjunId).single()
  await service.from("profiles").update({ pod_id: arjunNow!.pod_id }).eq("id", c.riyaId)
  await service.from("pods").update({ leader_id: c.riyaId }).eq("id", arjunNow!.pod_id!)
  const old = new Date(Date.now() - 5 * 86_400_000).toISOString()
  const { data: lead, error: leadErr } = await service
    .from("leads")
    .insert({ name: "Pool Test", phone: c.phone, source: "Campus", owner_id: c.arjunId })
    .select("id")
    .single()
  if (leadErr) throw leadErr
  // Make it look untouched for 5 days.
  await service.from("leads").update({ last_touched_at: old, assigned_at: old }).eq("id", lead.id)

  const { error: helpErr } = await c.intern.from("help_requests").insert({ lead_id: lead.id, requested_by: c.arjunId, reason: "Parent call" })
  check("A pod member can ask for help on their lead", !helpErr, helpErr?.message)
  const { data: flagged } = await service.from("leads").select("help_requested").eq("id", lead.id).single()
  check("The lead shows Help requested", flagged?.help_requested === true)
  const { data: leaderSees } = await c.leader.from("help_requests").select("id").eq("lead_id", lead.id)
  check("The pod leader sees the help request", (leaderSees?.length ?? 0) === 1)
  const { data: otherSees } = await c.other.from("help_requests").select("id").eq("lead_id", lead.id)
  check("Other pods don't see it", (otherSees?.length ?? 0) === 0)
  const { data: selfClose } = await c.intern.from("help_requests").update({ status: "Handled" }).eq("lead_id", lead.id).select()
  check("The asker can't close their own request", (selfClose?.length ?? 0) === 0)
  const { data: taken } = await c.leader.from("help_requests").update({ status: "Taken" }).eq("lead_id", lead.id).select("helper_id").single()
  check("Take it makes the pod leader the helper", taken?.helper_id === c.riyaId)
  await c.leader.from("help_requests").update({ status: "Handled" }).eq("lead_id", lead.id)
  const { data: cleared } = await service.from("leads").select("help_requested").eq("id", lead.id).single()
  check("Mark handled clears Help requested", cleared?.help_requested === false)

  const { data: myPool } = await c.leader.rpc("pool_leads", { p_pod: null })
  check("An untouched lead shows in its pod's pool", (myPool ?? []).some((l: { id: string }) => l.id === lead.id))
  const { data: theirPool } = await c.other.rpc("pool_leads", { p_pod: null })
  check("Other pods don't see it in their pool", !(theirPool ?? []).some((l: { id: string }) => l.id === lead.id))
  const { error: strangerClaim } = await c.other.rpc("claim_lead", { p_lead: lead.id })
  check("Someone from another pod can't claim it", !!strangerClaim)
  const { error: claimErr } = await c.leader.rpc("claim_lead", { p_lead: lead.id })
  const { data: claimed } = await service.from("leads").select("owner_id").eq("id", lead.id).single()
  check("A pod member can claim it, and it becomes theirs", !claimErr && claimed?.owner_id === c.riyaId, claimErr?.message)
  const { data: afterClaim } = await c.leader.rpc("pool_leads", { p_pod: null })
  check("A claimed lead leaves the pool", !(afterClaim ?? []).some((l: { id: string }) => l.id === lead.id))

  // The pod leader is also a working intern: their help requests go to the admins.
  const { error: leaderHelpErr } = await c.leader
    .from("help_requests")
    .insert({ lead_id: lead.id, requested_by: c.riyaId, reason: "Price objection" })
  const { data: adminNote } = await service
    .from("notifications")
    .select("user_id")
    .like("text", "%(pod leader) asked for help on Pool Test%")
  check("A pod leader can ask for help, and it goes to the admins", !leaderHelpErr && (adminNote?.length ?? 0) > 0, leaderHelpErr?.message)
  const { data: adminTook } = await c.admin.from("help_requests").update({ status: "Handled" }).eq("lead_id", lead.id).eq("requested_by", c.riyaId).select()
  check("An admin can handle a pod leader's help request", (adminTook?.length ?? 0) === 1)
  await service.from("notifications").delete().like("text", "%asked for help on Pool Test%")

  // Deactivated owner → their open leads go to the pool.
  await service.from("leads").update({ owner_id: c.arjunId }).eq("id", lead.id)
  await service.from("profiles").update({ active: false }).eq("id", c.arjunId)
  const { data: inactivePool } = await c.leader.rpc("pool_leads", { p_pod: null })
  await service.from("profiles").update({ active: true }).eq("id", c.arjunId)
  check("A deactivated person's open leads go to the pool", (inactivePool ?? []).some((l: { id: string }) => l.id === lead.id))

  const { data: setUpd } = await c.leader.from("settings").update({ pool_hours: 1 }).eq("id", 1).select()
  check("Pod leaders can't change settings", (setUpd?.length ?? 0) === 0)
  await service.from("help_requests").delete().eq("lead_id", lead.id)
}

/** Phase 3: payments and verification. The test lead is owned by Riya (the pod leader) by now. */
async function paymentChecks(c: {
  intern: SupabaseClient
  other: SupabaseClient
  admin: SupabaseClient
  anon: SupabaseClient
  leadId: string
  ownerId: string
}) {
  const leader = await signInAs("sample.riya@example.com")
  const { data: course } = await service.from("courses").select("id").eq("slug", "ai-corporate-analyst").single()
  await service.from("leads").update({ course_id: course!.id }).eq("id", c.leadId)
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
  const txn = `TEST-${Date.now()}`

  const { error: strangerPay } = await c.other
    .from("payments")
    .insert({ lead_id: c.leadId, amount: 2500, paid_on: today, txn_ref: txn + "-x" })
  check("Interns can't log payments on someone else's lead", !!strangerPay)

  const { data: pay, error: payErr } = await leader
    .from("payments")
    .insert({ lead_id: c.leadId, amount: 2500, paid_on: today, txn_ref: txn, status: "Verified" })
    .select("id, status, owner_id")
    .single()
  check("Owner can log a payment, and it always starts as Pending", !payErr && pay?.status === "Pending", payErr?.message)
  check("The sale is credited to the lead owner", pay?.owner_id === c.ownerId)
  const { data: afterLog } = await service.from("leads").select("stage").eq("id", c.leadId).single()
  check("Logging a payment moves the lead to Payment pending", afterLog?.stage === "Payment pending")

  const { error: dupTxn } = await service
    .from("payments")
    .insert({ lead_id: c.leadId, amount: 2500, paid_on: today, txn_ref: txn.toLowerCase() })
  check("The same transaction ID can't be logged twice", dupTxn?.code === "23505" || /installments/.test(dupTxn?.message ?? ""))
  const { error: second } = await leader
    .from("payments")
    .insert({ lead_id: c.leadId, amount: 1000, paid_on: today, txn_ref: txn + "-2" })
  check("A second payment is blocked when the course has no installments", !!second)

  const { data: selfVerify } = await leader.from("payments").update({ status: "Verified" }).eq("id", pay!.id).select()
  check("Interns and pod leaders can't verify payments", (selfVerify?.length ?? 0) === 0)
  const { data: anonPay } = await c.anon.from("payments").select("id")
  check("Logged-out visitors can't read payments", (anonPay?.length ?? 0) === 0)

  const { data: lbBefore } = await leader.rpc("leaderboard_payments")
  check("Pending payments don't count on the leaderboard", !(lbBefore ?? []).some((p: { lead_id: string }) => p.lead_id === c.leadId))

  const { error: noReason } = await c.admin.from("payments").update({ status: "Rejected" }).eq("id", pay!.id)
  check("Rejecting needs a reason", !!noReason)
  const { error: verifyErr } = await c.admin.from("payments").update({ status: "Verified" }).eq("id", pay!.id)
  check("Admin can verify", !verifyErr, verifyErr?.message)
  const { data: won } = await service.from("leads").select("stage").eq("id", c.leadId).single()
  check("A verified payment makes the lead Won", won?.stage === "Won")
  const { data: lbAfter } = await leader.rpc("leaderboard_payments")
  check("Verified payments count on the leaderboard", (lbAfter ?? []).some((p: { lead_id: string }) => p.lead_id === c.leadId))

  const { data: notes } = await leader.from("notifications").select("text").eq("link", `/leads/${c.leadId}`)
  check(
    "The owner is notified in the spec's words",
    (notes ?? []).some((n) => n.text === "Your ₹2,500 payment for Test Lead was verified"),
    JSON.stringify(notes)
  )
  const { data: othersNotes } = await c.other.from("notifications").select("id").eq("link", `/leads/${c.leadId}`)
  check("Nobody else sees that notification", (othersNotes?.length ?? 0) === 0)

  const { error: changeAmount } = await c.admin.from("payments").update({ amount: 99999 }).eq("id", pay!.id)
  check("A logged payment's amount can't be edited", !!changeAmount)
  const { error: backToPending } = await c.admin.from("payments").update({ status: "Pending" }).eq("id", pay!.id)
  check("A verified payment can't go back to Pending", !!backToPending)

  const { error: refundErr } = await c.admin
    .from("payments")
    .update({ status: "Refunded", reason: "Test refund" })
    .eq("id", pay!.id)
  const { data: refunded } = await service.from("leads").select("stage, temperature").eq("id", c.leadId).single()
  check("Refunding the only payment closes the lead as Lost", !refundErr && refunded?.stage === "Lost" && refunded?.temperature === "Closed", refundErr?.message)
  const { data: lbRefund } = await leader.rpc("leaderboard_payments")
  check("Refunded payments stop counting", !(lbRefund ?? []).some((p: { lead_id: string }) => p.lead_id === c.leadId))
}

/**
 * The checks need a known layout: Riya (leader) + Arjun in one test pod, Meera in another.
 * Whatever pods these sample people are in now is put back afterwards.
 */
async function main() {
  const emails = ["sample.riya@example.com", "sample.arjun@example.com", "sample.meera@example.com"]
  const { data: before } = await service.from("profiles").select("id, email, pod_id").in("email", emails)
  const { data: podsBefore } = await service.from("pods").select("id, leader_id")
  const id = (e: string) => before!.find((p) => p.email === e)!.id

  const { data: testPods, error } = await service
    .from("pods")
    .insert([{ name: "_check A" }, { name: "_check B" }])
    .select("id")
  if (error) throw error
  try {
    await service.from("profiles").update({ pod_id: testPods![0].id }).in("id", [id(emails[0]), id(emails[1])])
    await service.from("profiles").update({ pod_id: testPods![1].id }).eq("id", id(emails[2]))
    await service.from("pods").update({ leader_id: id(emails[0]) }).eq("id", testPods![0].id)
    await run()
  } finally {
    for (const p of before!) await service.from("profiles").update({ pod_id: p.pod_id }).eq("id", p.id)
    for (const p of podsBefore!) await service.from("pods").update({ leader_id: p.leader_id }).eq("id", p.id)
    await service.from("pods").delete().in("id", testPods!.map((p) => p.id))
  }
  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll security checks passed.")
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
