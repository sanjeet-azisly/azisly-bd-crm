import { PageHeader } from "@/components/page-header"
import { requireUser } from "@/lib/auth"
import { buildLeaderboard, loadLeaderboardData } from "@/lib/leaderboard"
import { monthFor } from "@/lib/program"
import { createClient } from "@/lib/supabase/server"
import { Calculator, type CalcCourse } from "./calculator"

export const metadata = { title: "Earnings · Azisly BD CRM" }

const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })

export default async function EarningsPage() {
  const me = await requireUser()
  const supabase = await createClient()
  const [data, { data: courses }] = await Promise.all([
    loadLeaderboardData(supabase),
    supabase.from("courses").select("id, short_name, name, offer_price, tier").eq("active", true).order("sort_order").order("offer_price"),
  ])
  const month = monthFor(data.settings)
  const board = buildLeaderboard(data, "month")
  const mine = board.individuals.find((i) => i.id === me.profile.id)?.revenue ?? 0
  const podRevenue = me.ledPod ? (board.pods.find((p) => p.id === me.ledPod!.id)?.revenue ?? 0) : 0
  const interns = me.ledPod ? data.people.filter((p) => p.pod_id === me.ledPod!.id).length : 0

  const mode = me.isManager ? "manager" : me.isAdmin ? "both" : "intern"
  return (
    <>
      <PageHeader
        title="Earnings calculator"
        description={
          mode === "manager"
            ? "Plan your pod’s month: pick how many of each course the pod will sell and see the revenue and your share."
            : "Pick how many of each course you’ll sell this month and see the revenue and the stipend it earns."
        }
      />
      <Calculator
        mode={mode}
        courses={((courses ?? []) as CalcCourse[]).map((c) => ({ ...c, offer_price: Number(c.offer_price) }))}
        settings={data.settings}
        monthLabel={`${month.key} · ${day(month.start)} – ${day(month.end)}`}
        milestone={month.milestone}
        verifiedSoFar={mode === "manager" ? podRevenue : mine}
        commissionPct={me.profile.commission_pct === null ? null : Number(me.profile.commission_pct)}
        internCount={interns}
        podName={me.ledPod?.name ?? null}
      />
    </>
  )
}
