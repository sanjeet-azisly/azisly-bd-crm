import Link from "next/link"
import { Chip, type ChipTone } from "@/components/chip"
import { PageHeader } from "@/components/page-header"
import { formatDateTime } from "@/lib/leads"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { DismissButton } from "./dismiss-button"

export const metadata = { title: "Flagged leads · Azisly BD CRM" }

const VIA: Record<string, string> = { add_lead: "Add lead", edit_lead: "Edit lead", course_page: "course page" }

type Row = {
  id: string
  phone: string
  attempted_name: string | null
  attempted_email: string | null
  via: string
  attempted_by: string | null
  created_at: string
  dismissed_at: string | null
  lead: { id: string; name: string; stage: string; owner_id: string; pod_id: string | null; owner: { full_name: string } | null } | null
  attempter: { full_name: string; pod_id: string | null } | null
  referrer: { full_name: string } | null
}

/** Redundant leads: every attempt to add a number that's already in the CRM. */
export default async function FlagsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams
  const tab = raw === "dismissed" ? "dismissed" : "open"
  const supabase = await createClient()
  let query = supabase
    .from("duplicate_attempts")
    .select(
      "id, phone, attempted_name, attempted_email, via, attempted_by, created_at, dismissed_at, lead:leads(id, name, stage, owner_id, pod_id, owner:profiles!leads_owner_id_fkey(full_name)), attempter:profiles!duplicate_attempts_attempted_by_fkey(full_name, pod_id), referrer:profiles!duplicate_attempts_referrer_id_fkey(full_name)"
    )
    .order("created_at", { ascending: false })
    .limit(300)
  query = tab === "open" ? query.is("dismissed_at", null) : query.not("dismissed_at", "is", null)
  const [{ data }, { count: openCount }] = await Promise.all([
    query,
    supabase.from("duplicate_attempts").select("id", { count: "exact", head: true }).is("dismissed_at", null),
  ])
  const rows = (data ?? []) as unknown as Row[]

  // How many times each lead has been hit, so repeat targets stand out.
  const hits = new Map<string, number>()
  for (const r of rows) if (r.lead) hits.set(r.lead.id, (hits.get(r.lead.id) ?? 0) + 1)

  return (
    <>
      <PageHeader
        title="Flagged leads"
        description="Someone tried to add a number that’s already in the CRM. Check for clashes between interns, then dismiss."
      />
      <nav className="mb-8 flex gap-1 rounded-full bg-surface p-1 text-sm" aria-label="Flag status">
        {(["open", "dismissed"] as const).map((t) => (
          <Link
            key={t}
            href={`/admin/flags?tab=${t}`}
            className={cn("flex-1 rounded-full px-4 py-2 text-center", tab === t ? "bg-brand-soft font-medium text-brand" : "text-muted-foreground hover:text-foreground")}
          >
            {t === "open" ? `Open${openCount ? ` (${openCount})` : ""}` : "Dismissed"}
          </Link>
        ))}
      </nav>

      <ul className="space-y-3">
        {rows.map((r) => {
          const relation = relationOf(r)
          return (
            <li key={r.id} className="rounded-2xl bg-surface p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    +91 {r.phone.replace(/(\d{5})(\d{5})/, "$1 $2")}
                    {r.attempted_name && <span className="font-normal text-muted-foreground"> · entered as “{r.attempted_name}”</span>}
                  </p>
                  {r.attempted_email && <p className="text-xs text-muted-foreground">{r.attempted_email}</p>}
                  <p className="text-sm">
                    Already with <strong>{r.lead?.owner?.full_name ?? "–"}</strong> as{" "}
                    {r.lead ? (
                      <Link href={`/leads/${r.lead.id}`} className="text-brand underline-offset-2 hover:underline">
                        {r.lead.name}
                      </Link>
                    ) : (
                      "a deleted lead"
                    )}{" "}
                    {r.lead && <span className="text-muted-foreground">({r.lead.stage})</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {r.via === "course_page"
                      ? `A prospect re-submitted through ${r.referrer ? `${r.referrer.full_name}’s` : "a"} course page link`
                      : `${r.attempter?.full_name ?? "Someone"} tried via ${VIA[r.via]}`}{" "}
                    · {formatDateTime(r.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={relation.tone}>{relation.label}</Chip>
                  {r.lead && (hits.get(r.lead.id) ?? 0) > 1 && <Chip tone="amber">{hits.get(r.lead.id)} attempts on this lead</Chip>}
                </div>
              </div>
              {tab === "open" && (
                <div className="mt-3 flex justify-end gap-2 border-t pt-3">
                  {r.lead && (
                    <Link href={`/leads/${r.lead.id}`} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
                      Open lead
                    </Link>
                  )}
                  <DismissButton ids={[r.id]} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {rows.length === 0 && (
        <p className="rounded-2xl bg-surface p-10 text-center text-sm text-muted-foreground">
          {tab === "open" ? "No flagged leads. 🎉" : "Nothing dismissed yet."}
        </p>
      )}
    </>
  )
}

/** Who bumped into whom: another pod is the one to look at first. */
function relationOf(r: Row): { label: string; tone: ChipTone } {
  if (r.via === "course_page") {
    const sameOwner = r.referrer && r.lead?.owner?.full_name === r.referrer.full_name
    return sameOwner ? { label: "Own link", tone: "grey" } : { label: "Prospect re-submitted", tone: "blue" }
  }
  if (!r.lead || !r.attempted_by) return { label: "Duplicate", tone: "grey" }
  if (r.attempted_by === r.lead.owner_id) return { label: "Own lead", tone: "grey" }
  if (r.attempter?.pod_id && r.attempter.pod_id === r.lead.pod_id) return { label: "Same pod", tone: "amber" }
  return { label: "Other pod", tone: "red" }
}
