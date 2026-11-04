# Azisly BD CRM – Build Spec

Owner: Sanjeet (Senior PM, Azisly.ai) · Builder: Claude Code · Deploy: Vercel · Version 1.0 · 3 Nov 2026

One web app for the 90-day BD internship batch (Day 1 = 10 Nov 2026). It does three jobs in this order: **information** (interns know every course and its value), **sales** (interns convey that value and close), **tracking** (everyone sees where every lead, intern and pod stands).

---

## 1. Problem

1. As an **intern**, I want one place to log my leads, mark them Hot / Warm / Cold, and see who to follow up today, so that no lead goes cold because I forgot.
2. As an **intern**, I want each course's value, pitch and objection answers in my pocket, plus a shareable course page with my name on it, so that I can explain value confidently and every lead I bring is credited to me.
3. As an **intern**, I want to see my revenue against my monthly milestone and my rank, so that I know exactly how far I am from the next stipend slab.
4. As a **pod leader**, I want a summary of my pod (revenue, gaps, hot leads, overdue follow-ups, help requests), so that I can step in where a deal is stuck.
5. As the **admin** (Sanjeet / Prasun), I want to create pods, mark leaders, verify every sale, edit course info and see cohort revenue against the ₹10L business target and ₹20L stretch, so that the program runs on real numbers.

---

## 2. High-level user journey

1. Given the admin has logged in, the admin adds courses, creates pods, invites interns by email and marks one **Pod leader** per pod.
2. Given an intern has accepted the invite and logged in, the intern lands on **Today** and sees their follow-ups, revenue meter and rank.
3. The intern opens **Courses**, reads value, pitch and objections, and copies their personal course page link to send on WhatsApp / LinkedIn.
4. A prospect opens the link, reads the course page and submits **I’m interested**. The lead lands in that intern's **Leads** list as New.
5. The intern also adds leads manually (own network, campus, fests, alumni, webinar, company-provided, B2B).
6. For each lead the intern fills BANT, which sets **Hot / Warm / Cold**, moves it through stages, and logs every touch (call, WhatsApp, demo, note) with a next follow-up date.
7. When the prospect pays through the official Azisly payment link, the intern taps **Log payment** and enters amount, date and transaction ID. Status = **Pending verification**.
8. The admin verifies the payment. Only then does it count on the intern's meter, the pod total and the leaderboards.
9. Pod leaders watch the **My pod** tab and pick up leads from the **Help queue**.
10. The admin watches the **Dashboard** and exports CSV for the weekly report.

---

## 3. Roles and access

| Action | Intern | Pod leader | Admin |
|---|---|---|---|
| See own leads, add / edit own leads | Yes | Yes | Yes |
| See pod's leads | No | Yes (read + reassign within pod) | Yes |
| See all leads | No | No | Yes |
| Courses hub, own course links | Yes | Yes | Yes |
| Log payment | Own leads | Own + pod leads | Any |
| Verify / reject / refund payment | No | No | Yes |
| Leaderboards (individual + pod) | Yes | Yes | Yes |
| My pod summary + Help queue | No | Yes | Yes (any pod) |
| Dashboard, CSV export | No | No | Yes |
| Team, pods, leader marking, courses, settings | No | No | Yes |

1. Roles are **Admin**, **Pod leader**, **Intern**. A pod leader is an intern with leader flag on their pod; they keep selling.
2. More than one admin is allowed.
3. Only invited emails can log in. An uninvited email sees: "This account isn’t on the Azisly BD team. Ask your program admin for an invite."
4. Deactivated users cannot log in; their open leads move to the pool automatically.

---

## 4. Courses (seed data – admin can edit, add, deactivate)

| Course | Offer price | Original price | Typical close | Tier |
|---|---|---|---|---|
| AI Corporate Analyst Program | ₹2,500 | ₹5,894 | 2–5 days | Entry |
| TIFxAzisly – AI in Entrepreneurship | ₹7,000 | ₹11,800 | 1–2 weeks | Core |
| TIF [full course name TBD] | ₹50,000 | [TBD] | [TBD] | Premium |
| Sure Shot / Sure Job Ready [confirm name] | ₹1,50,000 | [TBD] | 3–6 weeks | Premium |

Each course has: **Name**, **Short name** (shown in lists), **Offer price**, **Original price**, **Typical close time**, **Tier**, **Who it’s for**, **What they get** (up to 6 bullet points), **Proof** (partner, certificate, outcomes), **60-second pitch**, **Objections** (question + answer pairs), **Brochure link**, **Official payment link**, **Installments allowed** (Yes/No), **Active** (Yes/No).

---

## 5. Feature details

### 5.1 Login and invites
1. Login with **Google** or **email one-time code**.
2. Admin invites by email from **Team**: name, email, role, pod. The invite email reads:
   a. Subject: "You’re invited to the Azisly BD CRM"
   b. Body: "Hi {name}, you’ve been added to the Azisly BD Internship CRM. Log in with this email at {app_url} to see your leads, courses and leaderboard."
3. On first login each user gets a **Referral code** (first name + 2 digits, editable by admin, unique). It is attached to their course page links.

### 5.2 Today (intern home)
1. **Revenue meter** (top, the most prominent element):
   a. Verified revenue this program month, large.
   b. Progress bar with marks at the month's milestone and stipend slabs (₹65K, ₹80K, ₹1L).
   c. Line under the bar: "{₹gap} to the {₹slab} slab" or "Milestone hit 🎉" once crossed.
   d. **Estimated stipend** this month (slab rules in 6.4), labelled "Estimated – final after verification".
   e. Small line: "{n} payments pending verification ({₹amount})".
2. **Rank chip**: "#{rank} of {n} this month" → opens Leaderboard.
3. **Due today**: open leads with next follow-up today or earlier, sorted Hot first, then oldest due date. Each row: name, course short name, temperature chip, stage, touches "3/7", one-tap **WhatsApp** and **Call** buttons, **Log touch** button.
4. **Daily activity strip**: today's counts vs targets, auto-counted from logged touches: Outreach {x}/25, Follow-ups {x}/10, Demos {x}/1. Targets editable in Settings.
5. Empty state: "Nothing due today. Add a lead or share a course page to start your day." + **Add lead** button.

### 5.3 Leads
1. Views: **List** (default) and **Board** (columns by stage, drag to move).
2. Filters: Temperature, Stage, Course, Source, Follow-up (Overdue / Today / This week / None).
3. Search by name or phone.
4. **Add lead** form:
   a. **Name** – required, 2–80 characters.
   b. **WhatsApp number** – required, exactly 10 digits, digits only. Error: "Enter a 10-digit mobile number."
   c. **Persona** – Student / Fresh graduate / Working professional / Parent / College (B2B) / Corporate (B2B).
   d. **College / company**, **City** – optional.
   e. **Source** – Campus / WhatsApp / LinkedIn / Instagram / Fests & events / Alumni / Referral / Webinar / Course page / Company-provided / B2B meeting.
   f. **Interested in** – course dropdown (active courses).
   g. **Next follow-up** – date, defaults to tomorrow.
   h. **Duplicate check** on save: if the number exists anywhere, block and show "This number is already with {owner name} ({stage}). Ask your pod leader before working it." Admin can override.
   i. Toast: "Lead added".

### 5.4 Lead detail
1. Header: name, phone, course, **Temperature** chip, **Stage** dropdown, owner, pod.
2. **BANT** – four toggles, each with a one-line hint:
   a. **Budget** – "Can pay the offer price, or someone will pay for them."
   b. **Authority** – "Decides alone, or the decider (often a parent) is in the conversation."
   c. **Need** – "Has a clear goal this course serves."
   d. **Timeline** – "Ready to decide within 7 days."
   e. Temperature is set from BANT: 4 Yes = **Hot** (Red), 2–3 = **Warm** (Amber), 0–1 = **Cold** (Blue). Won leads show **Won** (Green); Lost / Nurture show **Closed** (Grey).
3. **Stages**: New → Contacted → Qualified → Discovery done → Demo / Webinar → Negotiation → Payment link sent → **Won** / **Lost** / **Nurture**. Lost needs a reason: Price / Not interested / No response / Chose another option / Other.
4. **Log touch** buttons: **Called**, **WhatsApp**, **Demo / webinar**, **Note**. Each adds a timeline entry (type, note, time), increments **Touches** (max shown 7/7), updates last touched, and asks for the **Next follow-up** date.
5. **7-touch rule**: at 7 touches on an open lead, banner: "7 touches done. Move this lead to Nurture or Lost, or log a payment."
6. **Course quick panel**: selected course's pitch and objection answers, with **Copy course link** (with referral code).
7. **Ask for help** (pod members): reason dropdown (Parent call / Price objection / Demo needed / Other) + note. Toast: "Sent to your pod leader". Lead shows "Help requested" chip until the pod leader marks it handled.
8. **Payments** section (see 5.7).
9. **Timeline**: every touch, stage change, payment and reassignment, newest first.

### 5.5 Courses hub (information)
1. One card per active course: name, offer price with original struck through, tier, close time.
2. Course page in the hub: **Who it’s for**, **What they get**, **Proof**, **60-second pitch**, **Objections**, brochure link.
3. **Share** block: personal course page link `/{course-slug}?ref={code}`, **Copy link**, **Share on WhatsApp** (prefilled: "Hi! Here’s the {course name} from Azisly.ai – {one-line value}. Details: {link}").
4. Admin-only **Edit course** button on each card.

### 5.6 Public course page (prospect-facing, no login)
1. Shows course name, value, what they get, proof, offer vs original price, and the referring intern's first name: "Shared by {first name}, Azisly.ai".
2. **I’m interested** form: name, WhatsApp number (10 digits), city, consent checkbox "I agree to be contacted by Azisly.ai about this course." Submit is disabled until consent is ticked.
3. On submit: lead created for the referring intern, Source = Course page, Stage = New, follow-up = today. Confirmation: "Thanks! {first name} from Azisly.ai will reach out shortly."
4. If the number already exists, no duplicate is created; the existing owner gets a timeline entry "Submitted interest again via {intern}'s link".
5. No payment on this page. Payment always happens through the official Azisly payment link the intern shares.

### 5.7 Payments and verification
1. **Log payment** (on a lead): course, amount (prefilled with offer price, editable for installments), payment date, transaction / reference ID (required), optional screenshot.
2. Status: **Pending verification** (Amber) → **Verified** (Green) or **Rejected** (Red); a verified payment can later be marked **Refunded** (Grey) with a reason.
3. Courses with **Installments allowed** can have several payments on one lead; each verified payment counts in the month of its payment date.
4. First verified payment moves the lead to **Won** automatically.
5. Admin **Verification queue**: oldest first; each row shows intern, lead, course, amount, date, transaction ID, screenshot; buttons **Verify** / **Reject** (reason required). Toast: "Payment verified" / "Payment rejected".
6. Intern sees a notification on status change: "Your ₹{amount} payment for {lead} was verified" / "…was rejected: {reason}".
7. Assisted close: payment can record **Assisted by** (pod leader / admin). Credit split rule [TBD – decide later]; v1 credits 100% to the lead owner and only shows the assist tag.

### 5.8 Leaderboards
1. Period filter: **This month** (default) / M1 / M2 / M3 / All 90 days.
2. **Individuals**: rank, name, pod, verified revenue, deals, conversion % (won / leads), gap to next slab. Current user's row highlighted.
3. **Pods**: rank, pod name, members, verified revenue, revenue per member, deals.
4. **Weekly highlights** (Monday–Sunday): Top seller, Biggest climber (rank change), Most leads added.
5. Only **Verified** payments count everywhere.

### 5.9 My pod (pod leader)
1. Pod header: pod name, leader, pod revenue this month vs pod target (sum of members' milestones), rank among pods.
2. Members table: name, revenue this month, gap to milestone, status (**On track** / **Behind** / **Milestone hit**, against pro-rata of the month), Hot leads, overdue follow-ups, today's outreach vs target.
3. **Help queue**: open help requests, oldest first, with **Take it** (assigns pod leader as helper) and **Mark handled**.
4. **Stuck deals**: pod leads at Payment link sent or Negotiation for 5+ days.
5. **Reassign** a pod lead to another pod member (logged on timeline).

### 5.10 Admin
1. **Dashboard**:
   a. Cards: verified revenue (90 days) vs ₹10L business and ₹20L stretch, this month's revenue, pending verification amount, interns with a sale this month.
   b. Revenue by program month vs monthly targets (bar chart).
   c. Revenue by course, by source, by pod.
   d. Funnel: leads → qualified → demo → payment link sent → won.
   e. Temperature split of open leads.
2. **Verification queue** (5.7).
3. **Team**: invite, edit role, change pod, edit referral code, deactivate.
4. **Pods**: create, **rename**, set colour, assign members, **mark leader** (one per pod; marking a new one unmarks the old one), set pod target override.
5. **Courses**: add / edit / deactivate (fields in section 4).
6. **All leads**: filters as 5.3 plus owner and pod; bulk reassign; **Export CSV**.
7. **Settings**: program dates (M1 starts 10 Nov 2026, M2 10 Dec 2026, M3 9 Jan 2027, ends 7 Feb 2027), intern milestones (₹65,000 / ₹80,000 / ₹1,00,000), stipend slabs, daily activity targets (25 / 10 / 1), cohort targets (business ₹10L, stretch ₹20L, monthly split [TBD]), untouched-lead pool hours (default 72).

---

## 6. Rules

1. **Duplicates**: one lead per phone number across the whole CRM (5.3 h, 5.6 d).
2. **Pool**: an open lead with no touch for {pool hours} shows "No touch 72h+" and appears in the **Pool** tab for its pod; any pod member can **Claim** it. Admin sees all pools.
3. **Revenue** counts only verified payments, by payment date, net of refunds.
4. **Stipend estimate** per program month on verified revenue:
   a. Below ₹10,000 → ₹0
   b. ₹10,000 – ₹65,000 → 10% of revenue
   c. ₹65,001 – ₹80,000 → ₹15,000 fixed
   d. ₹80,001 and above → higher of ₹20,000 or 25% of revenue
5. **Milestones**: M1 ₹65,000 (own leads), M2 ₹80,000 (company leads), M3 ₹1,00,000 (incl. B2B). Status vs pro-rata: Behind if revenue < milestone × days elapsed ÷ 30.
6. **Selling rules** shown on the Courses hub footer: never promise a job, placement or salary; only official prices and payment links; never collect money personally.

---

## 7. State matrix – lead chips and actions

| Stage | BANT Yes count | Payment status | Temperature chip | Primary action shown | Banner |
|---|---|---|---|---|---|
| New – Negotiation | 4 | none | **Hot** (Red) | Log touch | – |
| New – Negotiation | 2–3 | none | **Warm** (Amber) | Log touch | – |
| New – Negotiation | 0–1 | none | **Cold** (Blue) | Log touch | – |
| Any open, touches = 7 | any | none | as BANT | Log payment | "7 touches done. Move this lead to Nurture or Lost, or log a payment." |
| Any open, no touch ≥ pool hours | any | none | as BANT + "No touch 72h+" | Log touch | "This lead is in the pool. Log a touch to keep it." |
| Payment link sent | any | Pending | as BANT | View payment | "Payment of ₹{amount} pending verification." |
| Won | any | Verified | **Won** (Green) | Log payment (installment courses only) | – |
| Won | any | Rejected (only payment) | as BANT, stage back to Payment link sent | Log payment | "Payment rejected: {reason}. Check the transaction ID and log it again." |
| Won | any | Refunded (all payments) | **Closed** (Grey), stage → Lost | – | "Payment refunded. This sale no longer counts." |
| Lost / Nurture | any | none | **Closed** (Grey) | Reopen | – |

---

## 8. Out of scope for v1

1. ~~Sending WhatsApp messages from the app~~ – v1 opens WhatsApp with a prefilled message only.
2. ~~Payment gateway integration~~ – payments are logged and verified manually.
3. ~~Assisted-close revenue split~~ – [TBD], tag only.
4. ~~Founder webinar registrations inside the CRM~~ – Source "Webinar" covers it for now.

---

## 9. Build instructions for Claude Code

1. **Stack**: Next.js (App Router, TypeScript), Tailwind + shadcn/ui, Supabase (Postgres, Auth with Google + email OTP, Storage for screenshots, Row Level Security), Recharts for charts, deployed on Vercel. Mobile-first: interns mostly use phones.
2. **Data model** (tables): `profiles` (role, pod_id, referral_code, active), `pods` (name, colour, leader_id, target_override), `courses` (section 4 fields, slug), `leads` (owner_id, pod_id, contact fields, persona, source, course_id, bant_b/a/n/t, stage, lost_reason, touches, last_touched_at, next_follow_up, help_requested), `lead_events` (lead_id, user_id, type, note, created_at), `payments` (lead_id, owner_id, course_id, amount, paid_on, txn_ref, screenshot_path, status, reason, verified_by, assisted_by), `help_requests`, `invites`, `settings` (single row). Unique index on normalised phone.
3. **Security**: enforce section 3 with Supabase RLS, not just the UI. Public course page writes only through a server action that creates a New lead.
4. **Build in phases**, show me each phase running before the next:
   a. Phase 1 – Supabase project, auth, invites, roles, pods + leader marking, courses (admin).
   b. Phase 2 – Leads, lead detail, BANT, stages, touches, follow-ups, duplicates, Today page.
   c. Phase 3 – Payments, verification queue, revenue meter, stipend estimate, leaderboards.
   d. Phase 4 – Courses hub, public course pages, referral links, lead capture.
   e. Phase 5 – My pod, help queue, pool, admin dashboard, CSV export, settings.
5. **Seed**: the 4 courses in section 4, settings in 5.10.7, one admin account (my email), 2 sample pods and 3 sample interns that I can delete.
6. **Deploy**: walk me step by step – I am not technical. Tell me exactly what to click in GitHub, Supabase and Vercel and which keys to paste where.
7. **Branding**: Azisly.ai navy (#0C1B3D) and blue (#2346F5), Poppins headings, clean and fast on low-end Android phones.
