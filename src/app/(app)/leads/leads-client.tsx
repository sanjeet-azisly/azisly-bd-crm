"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Columns3, Download, List, Search, SlidersHorizontal, X } from "lucide-react"
import { toast } from "sonner"
import { Chip } from "@/components/chip"
import { Avatar } from "@/components/people"
import { ContactButtons } from "@/components/leads/contact-buttons"
import { StageDot, TempChip } from "@/components/leads/chips"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import {
  SOURCES,
  STAGES,
  TEMPERATURES,
  TOUCH_LIMIT,
  followUpBucket,
  formatDay,
  isOpen,
  istDate,
  type FollowUpFilter,
  type Lead,
} from "@/lib/leads"
import { toCsv } from "@/lib/csv"
import { cn } from "@/lib/utils"
import { bulkReassign } from "./actions"

export type LeadRow = Lead & { owner_name: string; course_short: string | null; pod_name: string | null }

const Board = dynamic(() => import("./board").then((m) => m.Board), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted-foreground">Loading board…</p>,
})

type Filters = { temp: string; stage: string; course: string; source: string; follow: string; owner: string; pod: string; q: string }
const NO_FILTERS: Filters = { temp: "", stage: "", course: "", source: "", follow: "", owner: "", pod: "", q: "" }
const VIEW_KEY = "azisly-leads-view"

const QUICK: { label: string; apply: (f: Filters) => Filters; match: (f: Filters) => boolean }[] = [
  {
    label: "All",
    apply: (f) => f,
    match: (f) => Object.entries(f).every(([k, v]) => k === "q" || !v),
  },
  {
    label: "Due today",
    apply: (f) => ({ ...f, follow: "today" }),
    match: (f) => f.follow === "today" && !f.temp && !f.stage,
  },
  {
    label: "Overdue",
    apply: (f) => ({ ...f, follow: "overdue" }),
    match: (f) => f.follow === "overdue" && !f.temp && !f.stage,
  },
  { label: "Hot", apply: (f) => ({ ...f, temp: "Hot" }), match: (f) => f.temp === "Hot" && !f.follow && !f.stage },
  {
    label: "Payment pending",
    apply: (f) => ({ ...f, stage: "Payment pending" }),
    match: (f) => f.stage === "Payment pending" && !f.temp && !f.follow,
  },
]

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

export function LeadsClient({
  meId,
  leads,
  courses,
  isAdmin,
  people,
  poolCount,
}: {
  meId: string
  leads: LeadRow[]
  courses: { id: string; short_name: string }[]
  isAdmin: boolean
  people: { id: string; full_name: string }[]
  poolCount: number
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [view, setView] = useState<"list" | "board">("list")
  const [f, setF] = useState<Filters>(NO_FILTERS)
  const today = istDate()

  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "board") setView("board")
    } catch {}
  }, [])
  function chooseView(v: "list" | "board") {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {}
  }

  const owners = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of leads) m.set(l.owner_id, l.owner_name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [leads])
  const showOwner = owners.length > 1 || (owners.length === 1 && owners[0][0] !== meId)
  const pods = useMemo(() => [...new Set(leads.map((l) => l.pod_name).filter((p): p is string => !!p))].sort(), [leads])

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    const digits = q.replace(/\D/g, "")
    return leads.filter(
      (l) =>
        (!f.temp || l.temperature === f.temp) &&
        (!f.stage || l.stage === f.stage) &&
        (!f.course || l.course_id === f.course) &&
        (!f.source || l.source === f.source) &&
        (!f.owner || l.owner_id === f.owner) &&
        (!f.pod || (f.pod === "none" ? !l.pod_name : l.pod_name === f.pod)) &&
        (!f.follow || followUpBucket(l.next_follow_up, today) === (f.follow as FollowUpFilter)) &&
        (!q ||
          l.name.toLowerCase().includes(q) ||
          (digits.length > 0 && l.phone.includes(digits)) ||
          (!!l.email && l.email.includes(q)))
    )
  }, [leads, f, today])

  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value })
  const activeCount = Object.entries(f).filter(([k, v]) => k !== "q" && v).length
  const active = activeCount > 0
  const [filtersOpen, setFiltersOpen] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, phone or email" value={f.q} onChange={set("q")} className="pl-10" />
        </div>
        <Button variant="outline" className="h-11 shrink-0" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal /> <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-brand px-1.5 text-xs font-semibold text-white">{activeCount}</span>
          )}
        </Button>
        <div className="flex shrink-0 rounded-full bg-surface p-1" role="group" aria-label="View">
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => chooseView("list")}
            className={cn("flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm", view === "list" && "bg-brand-soft font-medium text-brand")}
          >
            <List className="size-4" /> <span className="hidden sm:inline">List</span>
          </button>
          <button
            type="button"
            aria-pressed={view === "board"}
            onClick={() => chooseView("board")}
            className={cn("flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm", view === "board" && "bg-brand-soft font-medium text-brand")}
          >
            <Columns3 className="size-4" /> <span className="hidden sm:inline">Board</span>
          </button>
        </div>
      </div>

      {/* Quick filters for the everyday questions; everything else lives in the Filters panel. */}
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0" role="group" aria-label="Quick filters">
        {/* Pod leaders and admins also sell: "Mine" shows just the leads they own. */}
        {showOwner && (
          <button
            type="button"
            aria-pressed={f.owner === meId && Object.entries(f).every(([k, v]) => k === "q" || k === "owner" || !v)}
            onClick={() => setF({ ...NO_FILTERS, q: f.q, owner: meId })}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors",
              f.owner === meId ? "border-brand bg-brand text-white" : "border-border bg-white text-foreground/80 hover:bg-muted"
            )}
          >
            Mine
          </button>
        )}
        {QUICK.map((q) => {
          const on = q.match(f)
          return (
            <button
              key={q.label}
              type="button"
              aria-pressed={on}
              onClick={() => setF(q.apply({ ...NO_FILTERS, q: f.q }))}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors",
                on ? "border-brand bg-brand text-white" : "border-border bg-white text-foreground/80 hover:bg-muted"
              )}
            >
              {q.label}
            </button>
          )
        })}
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <FilterField label="Temperature">
              <NativeSelect value={f.temp} onChange={set("temp")}>
                <option value="">Any</option>
                {TEMPERATURES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </NativeSelect>
            </FilterField>
            <FilterField label="Stage">
              <NativeSelect value={f.stage} onChange={set("stage")}>
                <option value="">Any</option>
                {STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </FilterField>
            <FilterField label="Course">
              <NativeSelect value={f.course} onChange={set("course")}>
                <option value="">Any</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.short_name}
                  </option>
                ))}
              </NativeSelect>
            </FilterField>
            <FilterField label="Source">
              <NativeSelect value={f.source} onChange={set("source")}>
                <option value="">Any</option>
                {SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </FilterField>
            <FilterField label="Follow-up">
              <NativeSelect value={f.follow} onChange={set("follow")}>
                <option value="">Any</option>
                <option value="overdue">Overdue</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="none">None</option>
              </NativeSelect>
            </FilterField>
            {showOwner && (
              <FilterField label="Owner">
                <NativeSelect value={f.owner} onChange={set("owner")}>
                  <option value="">Anyone</option>
                  {owners.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </NativeSelect>
              </FilterField>
            )}
            {isAdmin && (
              <FilterField label="Pod">
                <NativeSelect value={f.pod} onChange={set("pod")}>
                  <option value="">Any</option>
                  {pods.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                  <option value="none">No pod</option>
                </NativeSelect>
              </FilterField>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setF({ ...NO_FILTERS, q: f.q })}>
              Clear all
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Show {filtered.length} leads</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-3">
          {filtered.length} of {leads.length} leads
          {poolCount > 0 && (
            <Link href="/pool" className="font-medium text-muted-foreground underline">
              {poolCount} in the pool
            </Link>
          )}
          {isAdmin && filtered.length > 0 && (
            <button type="button" className="flex items-center gap-1 text-brand" onClick={() => exportCsv(filtered)}>
              <Download className="size-3" /> Export CSV
            </button>
          )}
        </span>
        {active && (
          <button type="button" className="flex items-center gap-1 text-brand" onClick={() => setF({ ...NO_FILTERS, q: f.q })}>
            <X className="size-3" /> Clear filters
          </button>
        )}
      </div>

      {leads.length === 0 ? (
        <p className="rounded-2xl bg-surface p-10 text-center text-sm text-muted-foreground">
          No leads yet. Tap <strong>Add lead</strong> to log your first one.
        </p>
      ) : view === "board" ? (
        <Board leads={filtered} />
      ) : (
        <ul className="divide-y rounded-2xl bg-surface">
          {isAdmin && filtered.length > 0 && (
            <li className="flex items-center gap-3 bg-muted/40 px-3 py-2 text-xs">
              <Checkbox
                aria-label="Select all shown leads"
                checked={filtered.every((l) => selected.has(l.id))}
                onCheckedChange={(v) => setSelected(v ? new Set(filtered.map((l) => l.id)) : new Set())}
              />
              Select all shown
            </li>
          )}
          {filtered.map((l) => (
            <LeadListRow
              key={l.id}
              lead={l}
              showOwner={showOwner}
              today={today}
              selectable={isAdmin}
              selected={selected.has(l.id)}
              onSelect={(v) => {
                const next = new Set(selected)
                if (v) next.add(l.id)
                else next.delete(l.id)
                setSelected(next)
              }}
            />
          ))}
          {filtered.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No leads match.</li>}
        </ul>
      )}

      {isAdmin && selected.size > 0 && (
        <BulkBar
          ids={[...selected]}
          people={people}
          onDone={() => setSelected(new Set())}
        />
      )}
    </div>
  )
}

function BulkBar({ ids, people, onDone }: { ids: string[]; people: { id: string; full_name: string }[]; onDone: () => void }) {
  const router = useRouter()
  const [to, setTo] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <div className="fixed inset-x-0 bottom-16 z-30 mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-xl border bg-white p-3 shadow-2xl md:bottom-6">
      <span className="text-sm font-medium">{ids.length} selected</span>
      <div className="min-w-40 flex-1">
        <NativeSelect aria-label="Reassign to" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Reassign to…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button
        variant="secondary"
        className="h-10"
        disabled={!to || busy}
        onClick={async () => {
          setBusy(true)
          const res = await bulkReassign(ids, to)
          setBusy(false)
          if (!res.ok) return void toast.error(res.error)
          toast.success(`${res.data?.moved ?? 0} leads reassigned`)
          onDone()
          router.refresh()
        }}
      >
        Reassign
      </Button>
      <Button variant="ghost" className="h-10" onClick={onDone}>
        Clear
      </Button>
    </div>
  )
}

function exportCsv(rows: LeadRow[]) {
  const csv = toCsv(
    rows.map((l) => ({
      Name: l.name,
      Phone: `+91 ${l.phone}`,
      Email: l.email ?? "",
      Owner: l.owner_name,
      Pod: l.pod_name ?? "",
      Course: l.course_short ?? "",
      Source: l.source,
      Persona: l.persona ?? "",
      "College / company": l.college ?? "",
      City: l.city ?? "",
      Stage: l.stage,
      "Lost reason": l.lost_reason ?? "",
      Temperature: l.temperature,
      Budget: l.bant_b ? "Yes" : "No",
      Authority: l.bant_a ? "Yes" : "No",
      Need: l.bant_n ? "Yes" : "No",
      Timeline: l.bant_t ? "Yes" : "No",
      Touches: l.touches,
      "Next follow-up": l.next_follow_up ?? "",
      "Last touched": l.last_touched_at ?? "",
      Added: l.created_at,
    }))
  )
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `azisly-leads-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function LeadListRow({
  lead: l,
  showOwner,
  today,
  selectable,
  selected,
  onSelect,
}: {
  lead: LeadRow
  showOwner: boolean
  today: string
  selectable: boolean
  selected: boolean
  onSelect: (v: boolean) => void
}) {
  const bucket = followUpBucket(l.next_follow_up, today)
  const open = isOpen(l.stage)
  return (
    <li className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#fafbfc] sm:px-6">
      {selectable && <Checkbox aria-label={`Select ${l.name}`} checked={selected} onCheckedChange={(v) => onSelect(v === true)} />}
      <Avatar name={l.name} className="hidden sm:inline-flex" />
      <Link href={`/leads/${l.id}`} className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="truncate font-medium">{l.name}</span>
          {/* Won / Closed already show as the stage, so only open leads carry a temperature. */}
          {open && <TempChip temperature={l.temperature} />}
          {l.help_requested && <Chip tone="brand">Help</Chip>}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <StageDot stage={l.stage} />
          {l.course_short && <span>{l.course_short}</span>}
          <span>
            {Math.min(l.touches, TOUCH_LIMIT)}/{TOUCH_LIMIT} touches
          </span>
          {showOwner && <span>{l.owner_name}</span>}
        </p>
      </Link>
      {/* Follow-up on the right: red text when overdue, no extra pill. */}
      {open && l.next_follow_up && (
        <span
          className={cn(
            "hidden shrink-0 text-right text-sm sm:block",
            bucket === "overdue" ? "font-medium text-[#dc2626]" : bucket === "today" ? "font-medium text-brand" : "text-muted-foreground"
          )}
        >
          {bucket === "overdue" ? "Overdue" : "Follow up"}
          <span className="block text-xs font-normal text-muted-foreground">{formatDay(l.next_follow_up, today)}</span>
        </span>
      )}
      <ContactButtons phone={l.phone} />
    </li>
  )
}
