import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Chip } from "@/components/chip"
import { AddLeadButton } from "@/components/leads/add-lead-dialog"
import { StageDot, TempChip } from "@/components/leads/chips"
import { ContactButtons } from "@/components/leads/contact-buttons"
import { LogTouchButton } from "@/components/leads/log-touch-dialog"
import { RevenueMeter } from "@/components/revenue-meter"
import { roleLabel } from "@/components/user-menu"
import { requireUser } from "@/lib/auth"
import { firstName, formatINR } from "@/lib/format"
import { buildLeaderboard, loadLeaderboardData } from "@/lib/leaderboard"
import { monthFor } from "@/lib/program"
import {
  OPEN_STAGES,
  TOUCH_LIMIT,
  formatDay,
  istDate,
  istStartOfToday,
  sortDue,
  type Lead,
} from "@/lib/leads"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata = { title: "Today · Azisly BD CRM" }

type DueLead = Lead & { course: { short_name: string } | null }

export default async function TodayPage() {
  const me = await requireUser()
  const supabase = await createClient()
  const today = istDate()

  const [{ data: due }, { data: activity }, { data: settings }, { data: courses }, { data: pod }] = await Promise.all([
    supabase
      .from("leads")
      .select("*, course:courses(short_name)")
      .eq("owner_id", me.profile.id)
      .in("stage", OPEN_STAGES)
      .lte("next_follow_up", today),
    supabase
      .from("lead_events")
      .select("counts_as")
      .eq("user_id", me.profile.id)
      .gte("created_at", istStartOfToday())
      .not("counts_as", "is", null),
    supabase.from("settings").select("target_outreach, target_followups, target_demos").eq("id", 1).single(),
    supabase.from("courses").select("id, name, short_name").eq("active", true).order("sort_order"),
    me.profile.pod_id
      ? supabase.from("pods").select("name, colour").eq("id", me.profile.pod_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // Revenue meter + rank (interns, including pod leaders). Admins get the verification queue instead.
  let meter: React.ReactNode = null
  if (me.isAdmin) {
    const { data: pend } = await supabase.from("payments").select("amount").eq("status", "Pending")
    const n = pend?.length ?? 0
    meter = (
      <Link
        href="/admin/verify"
        className="flex items-center justify-between rounded-2xl bg-surface p-6 hover:bg-muted/50"
      >
        <span>
          <span className="block text-xs text-muted-foreground">Verification queue</span>
          <span className="font-heading text-2xl font-semibold">
            {n} {n === 1 ? "payment" : "payments"} to verify
          </span>
          {n > 0 && (
            <span className="block text-sm text-muted-foreground">
              {formatINR((pend ?? []).reduce((sum, p) => sum + Number(p.amount), 0))} waiting
            </span>
          )}
        </span>
        <ChevronRight className="size-6 text-muted-foreground" />
      </Link>
    )
  } else {
    const data = await loadLeaderboardData(supabase)
    const month = monthFor(data.settings, today)
    const { individuals } = buildLeaderboard(data, "month", today)
    const mine = individuals.find((i) => i.id === me.profile.id)
    const { data: myPending } = await supabase
      .from("payments")
      .select("amount")
      .eq("owner_id", me.profile.id)
      .eq("status", "Pending")
    meter = (
      <RevenueMeter
        revenue={mine?.revenue ?? 0}
        month={month}
        settings={data.settings}
        pending={{
          count: myPending?.length ?? 0,
          amount: (myPending ?? []).reduce((sum, p) => sum + Number(p.amount), 0),
        }}
        rank={mine ? { rank: mine.rank, of: individuals.length } : null}
      />
    )
  }

  const { data: pool } = me.profile.pod_id && !me.isAdmin ? await supabase.rpc("pool_leads", { p_pod: null }) : { data: [] }
  const poolCount = (pool ?? []).length

  const count = (kind: string) => (activity ?? []).filter((a) => a.counts_as === kind).length
  const strip = [
    { label: "Outreach", done: count("outreach"), target: settings?.target_outreach ?? 25 },
    { label: "Follow-ups", done: count("followup"), target: settings?.target_followups ?? 10 },
    { label: "Demos", done: count("demo"), target: settings?.target_demos ?? 1 },
  ]
  const dueLeads = sortDue((due ?? []) as DueLead[])

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">Hi {firstName(me.profile.full_name)}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {roleLabel(me)}
            {pod && (
              <Chip>
                <span className="size-2 rounded-full" style={{ background: pod.colour }} /> {pod.name}
              </Chip>
            )}
            {me.profile.referral_code && <Chip>Code: {me.profile.referral_code}</Chip>}
          </p>
        </div>
      </div>

      {!me.isAdmin && !me.profile.photo_path && (
        <Link
          href="/profile"
          className="flex items-center justify-between rounded-xl bg-brand-soft px-5 py-4 text-sm text-brand"
        >
          <span>
            <strong>Upload your ID card photo</strong> – a passport-size professional photo, takes a minute.
          </span>
          <ChevronRight className="size-4" />
        </Link>
      )}

      {meter}

      {/* Daily activity strip (spec 5.2.4) */}
      <section aria-label="Today’s activity" className="grid grid-cols-3 gap-2">
        {strip.map((s) => {
          const pct = Math.min(100, Math.round((s.done / Math.max(1, s.target)) * 100))
          return (
            <div key={s.label} className="rounded-xl bg-surface px-4 py-4 sm:p-5">
              <p className="truncate text-xs text-muted-foreground">{s.label}</p>
              <p className="font-heading text-xl font-semibold">
                {s.done}
                <span className="text-sm font-normal text-muted-foreground">/{s.target}</span>
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
                <div
                  className={cn("h-full rounded-full", s.done >= s.target ? "bg-[#16a34a]" : "bg-brand")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </section>

      {poolCount > 0 && (
        <Link
          href="/pool"
          className="flex items-center justify-between rounded-xl bg-[#fdf1d6] px-5 py-4 text-sm text-[#8a5300]"
        >
          <span>
            <strong>{poolCount}</strong> {poolCount === 1 ? "lead" : "leads"} in your pod’s pool – claim one to work it.
          </span>
          <ChevronRight className="size-4" />
        </Link>
      )}

      {/* Due today (spec 5.2.3) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Due today <span className="text-sm font-normal text-muted-foreground">({dueLeads.length})</span>
          </h2>
          {dueLeads.length > 0 && <AddLeadButton isAdmin={me.isAdmin} courses={courses ?? []} />}
        </div>

        {dueLeads.length === 0 ? (
          <div className="rounded-2xl bg-surface p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing due today. Add a lead or share a{" "}
              <Link href="/courses" className="text-brand underline">
                course page
              </Link>{" "}
              to start your day.
            </p>
            <AddLeadButton isAdmin={me.isAdmin} courses={courses ?? []} className="mt-3 h-10" />
          </div>
        ) : (
          <ul className="divide-y rounded-2xl bg-surface">
            {dueLeads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-4">
                <Link href={`/leads/${l.id}`} className="min-w-0 flex-1 basis-48">
                  <p className="flex items-center gap-2">
                    <span className="truncate font-medium">{l.name}</span>
                    <TempChip temperature={l.temperature} />
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <StageDot stage={l.stage} />
                    {l.course && <span>{l.course.short_name}</span>}
                    <span>
                      {Math.min(l.touches, TOUCH_LIMIT)}/{TOUCH_LIMIT} touches
                    </span>
                    {l.next_follow_up && l.next_follow_up < today && (
                      <span className="font-medium text-[#dc2626]">Overdue · {formatDay(l.next_follow_up, today)}</span>
                    )}
                  </p>
                </Link>
                <div className="flex items-center gap-1.5">
                  <ContactButtons
                    phone={l.phone}
                    greeting={`Hi ${firstName(l.name)}, this is ${firstName(me.profile.full_name)} from Azisly.ai.`}
                  />
                  <LogTouchButton leadId={l.id} leadName={l.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
