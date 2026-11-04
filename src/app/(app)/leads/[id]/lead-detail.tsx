"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  Clock,
  IndianRupee,
  LifeBuoy,
  Copy,
  MessageCircle,
  Pencil,
  PhoneCall,
  Presentation,
  RotateCcw,
  StickyNote,
  UserRound,
} from "lucide-react"
import { toast } from "sonner"
import { Chip } from "@/components/chip"
import { ContactButtons } from "@/components/leads/contact-buttons"
import { TempChip } from "@/components/leads/chips"
import { FollowUpPicker } from "@/components/leads/follow-up-picker"
import { LeadFormFields, leadPayload, validateLeadForm, type LeadFormValues } from "@/components/leads/lead-form-fields"
import { LogTouchDialog } from "@/components/leads/log-touch-dialog"
import { LogPaymentDialog } from "@/components/payments/log-payment-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NativeSelect } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { firstName, formatINR } from "@/lib/format"
import {
  BANT,
  HELP_REASONS,
  isInPool,
  OPEN_STAGES,
  STAGE_HINT,
  SEVEN_TOUCH_BANNER,
  TOUCH_LIMIT,
  courseLink,
  followUpBucket,
  formatDateTime,
  formatDay,
  isOpen,
  istDate,
  type BantKey,
  type Lead,
  type LeadEvent,
  type Stage,
  type TouchType,
} from "@/lib/leads"
import type { Course } from "@/lib/types"
import { cn } from "@/lib/utils"
import { reassignLead, reopenLead, setBant, setFollowUp, setStage, updateLeadDetails } from "../actions"
import { askForHelp } from "@/app/(app)/pod/actions"
import { Textarea } from "@/components/ui/textarea"
import { LostReasonDialog } from "../lost-reason-dialog"

type Props = {
  lead: Lead
  ownerName: string
  pod: { name: string; colour: string; leader_id: string | null } | null
  ownerActive: boolean
  poolHours: number
  /** Open duplicate-attempt flags on this lead (admins only; 0 for everyone else). */
  flagCount: number
  canAskHelp: boolean
  helpGoesTo: "leader" | "admins"
  openHelp: { id: string; reason: string; status: string; helper: string | null }[]
  events: (LeadEvent & { user_name: string | null })[]
  courses: Course[]
  me: { id: string; name: string; referralCode: string | null; isAdmin: boolean }
  reassignTo: { id: string; full_name: string }[]
  payments: LeadPayment[]
  assistOptions: { id: string; full_name: string }[]
}

export type LeadPayment = {
  id: string
  amount: number
  paid_on: string
  txn_ref: string
  status: "Pending" | "Verified" | "Rejected" | "Refunded"
  reason: string | null
  created_at: string
  course_name: string | null
  assisted_name: string | null
  screenshot_url: string | null
}

const EVENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  call: PhoneCall,
  whatsapp: MessageCircle,
  demo: Presentation,
  note: StickyNote,
  reassign: UserRound,
  payment: IndianRupee,
  help: LifeBuoy,
}
const EVENT_LABEL: Record<string, string> = {
  created: "Lead added",
  call: "Called",
  whatsapp: "WhatsApp",
  demo: "Demo / webinar",
  note: "Note",
  stage_change: "Stage changed",
  reassign: "Reassigned",
  payment: "Payment",
  help: "Help",
  interest_again: "Interest again",
}

export function LeadDetail({
  lead,
  ownerName,
  pod,
  ownerActive,
  poolHours,
  flagCount,
  canAskHelp,
  helpGoesTo,
  openHelp,
  events,
  courses,
  me,
  reassignTo,
  payments,
  assistOptions,
}: Props) {
  const router = useRouter()
  const [touchType, setTouchType] = useState<TouchType | null>(null)
  const [lostOpen, setLostOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [followOpen, setFollowOpen] = useState(false)
  const [bant, setBantState] = useState({ bant_b: lead.bant_b, bant_a: lead.bant_a, bant_n: lead.bant_n, bant_t: lead.bant_t })
  const course = courses.find((c) => c.id === lead.course_id) ?? null
  const open = isOpen(lead.stage)
  const [payOpen, setPayOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  // Rendered on the server with Date.now(); good enough for an "older than 72h" check.
  const [now] = useState(() => Date.now())
  const inPool = isInPool(lead, poolHours, ownerActive, now)
  const hasPending = payments.some((p) => p.status === "Pending")
  const hasLivePayment = payments.some((p) => p.status === "Pending" || p.status === "Verified")
  const pendingAmount = payments.filter((p) => p.status === "Pending").reduce((s, p) => s + p.amount, 0)
  const lastRejected = payments.find((p) => p.status === "Rejected") ?? null
  const refundedAll = payments.some((p) => p.status === "Refunded") && !hasLivePayment
  const installments = !!courses.find((c) => c.id === lead.course_id)?.installments_allowed
  const today = istDate()
  const bucket = followUpBucket(lead.next_follow_up, today)
  // Show the new temperature the moment a BANT switch flips (same rule as the database).
  const yes = Object.values(bant).filter(Boolean).length
  const temperature =
    lead.temperature === "Won" || lead.temperature === "Closed" ? lead.temperature : yes === 4 ? "Hot" : yes >= 2 ? "Warm" : "Cold"
  const greeting = `Hi ${firstName(lead.name)}, this is ${firstName(me.name)} from Azisly.ai.`

  async function changeStage(stage: Stage) {
    if (stage === lead.stage) return
    if (stage === "Lost") return setLostOpen(true)
    const res = await setStage(lead.id, { stage, lost_reason: null })
    if (!res.ok) return void toast.error(res.error)
    toast.success(`Moved to ${stage}`)
    router.refresh()
  }

  async function toggleBant(key: BantKey, value: boolean) {
    setBantState((b) => ({ ...b, [key]: value }))
    const res = await setBant(lead.id, key, value)
    if (!res.ok) {
      setBantState((b) => ({ ...b, [key]: !value }))
      return void toast.error(res.error)
    }
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Link href="/leads" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Leads
      </Link>

      {/* Header */}
      <section className="rounded-2xl bg-surface p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold sm:text-3xl">{lead.name}</h1>
              <TempChip temperature={temperature} />
              {lead.help_requested && <Chip tone="brand">Help requested</Chip>}
              {inPool && <Chip tone="amber">No touch {poolHours}h+</Chip>}
              {flagCount > 0 && (
                <Link href="/admin/flags">
                  <Chip tone="red">
                    {flagCount} duplicate {flagCount === 1 ? "attempt" : "attempts"}
                  </Chip>
                </Link>
              )}
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              <a href={`tel:+91${lead.phone}`} className="hover:text-foreground">
                +91 {lead.phone.replace(/(\d{5})(\d{5})/, "$1 $2")}
              </a>
              {lead.email && (
                <>
                  {" · "}
                  <a href={`mailto:${lead.email}`} className="hover:text-foreground">
                    {lead.email}
                  </a>
                </>
              )}
              {course && <> · {course.short_name}</>}
            </p>
            {/* Quiet facts in one line instead of a row of pills. */}
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <UserRound className="size-3.5" /> {ownerName}
              </span>
              {pod && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: pod.colour }} /> {pod.name}
                </span>
              )}
              <span>{lead.source}</span>
              {lead.persona && <span>{lead.persona}</span>}
              <span>
                {Math.min(lead.touches, TOUCH_LIMIT)}/{TOUCH_LIMIT} touches
              </span>
              {lead.stage === "Lost" && lead.lost_reason && <span>Lost: {lead.lost_reason}</span>}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil /> Edit
          </Button>
        </div>

        <div className="mt-7">
          <StepBar stage={lead.stage} onPick={changeStage} />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-sm">
          <p className="flex items-center gap-2">
            <CalendarClock className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Next follow-up</span>
            <span className={cn("font-medium", bucket === "overdue" && "text-[#dc2626]")}>
              {formatDay(lead.next_follow_up, today)}
              {bucket === "overdue" && " · overdue"}
            </span>
            <button type="button" onClick={() => setFollowOpen(true)} className="font-medium text-brand hover:underline">
              Change
            </button>
          </p>
          {open && (
            <p className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => changeStage("Nurture")}>
                Move to Nurture
              </Button>
              <Button variant="ghost" size="sm" className="text-[#b42318] hover:bg-[#fdecea]" onClick={() => setLostOpen(true)}>
                Mark as Lost
              </Button>
            </p>
          )}
        </div>
      </section>

      {/* Banners from the state matrix (section 7) */}
      {pendingAmount > 0 && (
        <Banner tone="amber">
          <Clock className="size-4 shrink-0" /> Payment of {formatINR(pendingAmount)} pending verification.
        </Banner>
      )}
      {lastRejected && !hasLivePayment && (
        <Banner tone="red">
          <AlertTriangle className="size-4 shrink-0" /> Payment rejected: {lastRejected.reason}. Check the transaction ID and
          log it again.
        </Banner>
      )}
      {refundedAll && (
        <Banner tone="grey">
          <AlertTriangle className="size-4 shrink-0" /> Payment refunded. This sale no longer counts.
        </Banner>
      )}
      {inPool && (
        <Banner tone="amber">
          <AlertTriangle className="size-4 shrink-0" /> This lead is in the pool. Log a touch to keep it.
        </Banner>
      )}
      {openHelp.map((h) => (
        <Banner key={h.id} tone="blue">
          <LifeBuoy className="size-4 shrink-0" />
          {h.status === "Taken" ? `${h.helper ?? "Your pod leader"} is helping (${h.reason}).` : `Help requested: ${h.reason}. Waiting for ${helpGoesTo === "leader" ? "your pod leader" : "the admins"}.`}
        </Banner>
      ))}
      {open && lead.touches >= TOUCH_LIMIT && !hasLivePayment && (
        <Banner tone="amber">
          <AlertTriangle className="size-4 shrink-0" /> {SEVEN_TOUCH_BANNER}
        </Banner>
      )}

      {/* Primary actions */}
      <section className="space-y-3 rounded-2xl bg-surface p-6">
        {open ? (
          <>
            {(lead.stage === "Payment pending" || lead.touches >= TOUCH_LIMIT || hasLivePayment) && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-soft p-3">
                <p className="text-sm font-medium text-navy">
                  {hasPending ? "Waiting for the admin to verify the payment." : "Did they pay through the official link?"}
                </p>
                {hasPending ? (
                  <a href="#payments" className={buttonVariants({ variant: "outline" })}>
                    View payment
                  </a>
                ) : (
                  <Button onClick={() => setPayOpen(true)}>
                    <IndianRupee /> Log payment
                  </Button>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Log touch</h2>
              <ContactButtons phone={lead.phone} greeting={greeting} size="default" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <TouchButton icon={PhoneCall} label="Called" onClick={() => setTouchType("call")} />
              <TouchButton icon={MessageCircle} label="WhatsApp" onClick={() => setTouchType("whatsapp")} />
              <TouchButton icon={Presentation} label="Demo / webinar" onClick={() => setTouchType("demo")} />
              <TouchButton icon={StickyNote} label="Note" onClick={() => setTouchType("note")} />
            </div>
            <div className="flex flex-wrap gap-2">
              {!(lead.stage === "Payment pending" || lead.touches >= TOUCH_LIMIT || hasLivePayment) && (
                <Button variant="outline" className="flex-1" onClick={() => setPayOpen(true)}>
                  <IndianRupee /> Log payment
                </Button>
              )}
              {canAskHelp && openHelp.length === 0 && (
                <Button variant="outline" className="flex-1" onClick={() => setHelpOpen(true)}>
                  <LifeBuoy /> Ask for help
                </Button>
              )}
            </div>
          </>
        ) : lead.stage === "Won" ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-foreground">This lead is Won. 🎉</p>
            {installments && (
              <Button onClick={() => setPayOpen(true)}>
                <IndianRupee /> Log installment
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">This lead is closed ({lead.stage}).</p>
            <Button
              onClick={async () => {
                const res = await reopenLead(lead.id)
                if (!res.ok) return void toast.error(res.error)
                toast.success("Lead reopened")
                router.refresh()
              }}
            >
              <RotateCcw /> Reopen
            </Button>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* BANT */}
        <section className="space-y-3 rounded-2xl bg-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">BANT</h2>
            <span className="text-xs text-muted-foreground">4 Yes = Hot · 2–3 = Warm · 0–1 = Cold</span>
          </div>
          <ul className="space-y-3">
            {BANT.map((b) => (
              <li key={b.key}>
                <label className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block text-sm font-medium">{b.label}</span>
                    <span className="block text-xs text-muted-foreground">{b.hint}</span>
                  </span>
                  <Switch checked={bant[b.key]} onCheckedChange={(v) => toggleBant(b.key, v)} aria-label={b.label} />
                </label>
              </li>
            ))}
          </ul>
        </section>

        {/* Course quick panel */}
        <CoursePanel course={course} referralCode={me.referralCode} />
      </div>

      {payments.length > 0 && <PaymentsList payments={payments} />}

      {reassignTo.length > 0 && <Reassign lead={lead} people={reassignTo} />}

      {/* Timeline */}
      <section className="rounded-2xl bg-surface p-6">
        <h2 className="mb-3 font-semibold">Timeline</h2>
        <ol className="space-y-3">
          {events.map((e) => {
            const Icon = EVENT_ICON[e.type]
            return (
              <li key={e.id} className="flex gap-3 text-sm">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  {Icon ? <Icon className="size-3.5" /> : <span className="size-1.5 rounded-full bg-navy" />}
                </span>
                <div className="min-w-0">
                  <p>
                    {e.type === "created" ? (
                      <span className="font-medium">{e.note ?? "Lead added"}</span>
                    ) : (
                      <span className="font-medium">{EVENT_LABEL[e.type] ?? e.type}</span>
                    )}
                    {(e.type === "stage_change" || e.type === "reassign") && (
                      <span className="text-muted-foreground"> · {e.note}</span>
                    )}
                  </p>
                  {e.note && !["stage_change", "reassign", "created"].includes(e.type) && (
                    <p className="whitespace-pre-wrap text-muted-foreground">{e.note}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(e.created_at)}
                    {e.user_name && <> · {e.user_name}</>}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      {touchType && (
        <LogTouchDialog
          key={touchType}
          leadId={lead.id}
          leadName={lead.name}
          initialType={touchType}
          open
          onOpenChange={(o) => !o && setTouchType(null)}
        />
      )}
      {lostOpen && (
        <LostReasonDialog
          leadName={lead.name}
          onCancel={() => setLostOpen(false)}
          onConfirm={async (reason) => {
            setLostOpen(false)
            const res = await setStage(lead.id, { stage: "Lost", lost_reason: reason })
            if (!res.ok) return void toast.error(res.error)
            toast.success("Marked as Lost")
            router.refresh()
          }}
        />
      )}
      {payOpen && (
        <LogPaymentDialog
          leadId={lead.id}
          leadName={lead.name}
          courses={courses
            .filter((c) => c.active || c.id === lead.course_id)
            .map((c) => ({ id: c.id, name: c.name, offer_price: Number(c.offer_price), installments_allowed: c.installments_allowed }))}
          defaultCourseId={lead.course_id}
          assistOptions={assistOptions}
          onClose={() => setPayOpen(false)}
        />
      )}
      {helpOpen && (
        <AskHelpDialog leadId={lead.id} leadName={lead.name} goesTo={helpGoesTo} onClose={() => setHelpOpen(false)} />
      )}
      {editOpen && <EditLeadDialog lead={lead} courses={courses} onClose={() => setEditOpen(false)} />}
      {followOpen && <FollowUpDialog lead={lead} onClose={() => setFollowOpen(false)} />}
    </div>
  )
}

const PAYMENT_TONE = { Pending: "amber", Verified: "green", Rejected: "red", Refunded: "grey" } as const

function PaymentsList({ payments }: { payments: LeadPayment[] }) {
  return (
    <section id="payments" className="scroll-mt-20 rounded-2xl bg-surface p-6">
      <h2 className="mb-3 font-semibold">Payments</h2>
      <ul className="divide-y">
        {payments.map((p) => (
          <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="font-medium">
                {formatINR(p.amount)} <span className="font-normal text-muted-foreground">· {p.course_name ?? "–"}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Paid {formatDay(p.paid_on)} · Txn {p.txn_ref}
                {p.assisted_name && <> · Assisted by {p.assisted_name}</>}
              </p>
              {p.reason && <p className="text-xs text-red-700">{p.reason}</p>}
            </div>
            <div className="flex items-center gap-2">
              {p.screenshot_url && (
                <a href={p.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand underline">
                  Screenshot
                </a>
              )}
              <Chip tone={PAYMENT_TONE[p.status]}>{p.status === "Pending" ? "Pending verification" : p.status}</Chip>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The 4 working steps as a slim stepper (dots on a line). Tap a step to move the lead there. */
function StepBar({ stage, onPick }: { stage: Stage; onPick: (s: Stage) => void }) {
  const current = OPEN_STAGES.indexOf(stage)
  const closed = current === -1
  return (
    <div>
      <ol className="grid grid-cols-4" aria-label="Stage">
        {OPEN_STAGES.map((s, i) => {
          const done = !closed && i < current
          const here = s === stage
          return (
            <li key={s} className="relative">
              {/* connector to the next step */}
              {i < OPEN_STAGES.length - 1 && (
                <span
                  aria-hidden
                  className={cn("absolute top-3.5 left-1/2 h-0.5 w-full", done ? "bg-brand" : "bg-[#e5e7eb]")}
                />
              )}
              <button
                type="button"
                onClick={() => onPick(s)}
                aria-current={here ? "step" : undefined}
                className="relative flex w-full flex-col items-center gap-2 text-center"
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    here && "bg-brand text-white ring-4 ring-brand-soft",
                    done && "bg-brand text-white",
                    !here && !done && "bg-white text-muted-foreground ring-1 ring-[#d9dce3] hover:ring-brand",
                    closed && "opacity-50"
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={cn("text-xs leading-tight", here ? "font-semibold text-foreground" : "text-muted-foreground")}>{s}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {closed ? (
          <>
            <strong className="text-foreground">{stage}</strong> · {STAGE_HINT[stage]}
          </>
        ) : (
          STAGE_HINT[stage]
        )}
      </p>
    </div>
  )
}

function Banner({ tone, children }: { tone: "amber" | "red" | "grey" | "blue"; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-xl px-5 py-4 text-sm font-medium",
        tone === "amber" && "bg-[#fdf1d6] text-[#8a5300]",
        tone === "red" && "bg-[#fdecea] text-[#b42318]",
        tone === "blue" && "bg-brand-soft text-brand",
        tone === "grey" && "bg-[#efeff2] text-[#55555b]"
      )}
    >
      {children}
    </div>
  )
}

function TouchButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-xl bg-[#f6f7f9] px-3 py-4 text-sm font-medium transition-colors hover:bg-brand-soft hover:text-brand"
    >
      <Icon className="size-5 text-brand" />
      {label}
    </button>
  )
}

function CoursePanel({ course, referralCode }: { course: Course | null; referralCode: string | null }) {
  if (!course) {
    return (
      <section className="rounded-2xl bg-surface p-6 text-sm text-muted-foreground">
        <h2 className="mb-1 font-semibold text-foreground">Course</h2>
        No course picked yet. Use <strong>Edit</strong> to set what they’re interested in.
      </section>
    )
  }
  return (
    <section className="space-y-3 rounded-2xl bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{course.short_name}</h2>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(courseLink(window.location.origin, course.slug, referralCode))
              toast.success("Course link copied")
            }}
          >
            <Copy /> Copy course link
          </Button>
          {course.payment_url && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(course.payment_url!)
                toast.success("Official payment link copied")
              }}
            >
              <IndianRupee /> Copy payment link
            </Button>
          )}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase">60-second pitch</p>
        <p className="mt-1 text-sm whitespace-pre-wrap">{course.pitch || "–"}</p>
      </div>
      {course.objections.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase">Objections</p>
          <ul className="mt-1 divide-y rounded-lg border">
            {course.objections.map((o, i) => (
              <li key={i}>
                <details className="group px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-medium">“{o.q}”</summary>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{o.a}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function Reassign({ lead, people }: { lead: Lead; people: { id: string; full_name: string }[] }) {
  const router = useRouter()
  const [to, setTo] = useState("")
  return (
    <section className="flex flex-wrap items-end gap-2 rounded-2xl bg-surface p-6">
      <label className="min-w-48 flex-1 space-y-1 text-sm">
        <span className="font-semibold">Reassign lead</span>
        <NativeSelect value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Pick a team member…</option>
          {people
            .filter((p) => p.id !== lead.owner_id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
        </NativeSelect>
      </label>
      <Button
        variant="secondary"
        className="h-10"
        disabled={!to}
        onClick={async () => {
          const res = await reassignLead(lead.id, to)
          if (!res.ok) return void toast.error(res.error)
          toast.success("Lead reassigned")
          setTo("")
          router.refresh()
        }}
      >
        Reassign
      </Button>
    </section>
  )
}

function EditLeadDialog({ lead, courses, onClose }: { lead: Lead; courses: Course[]; onClose: () => void }) {
  const router = useRouter()
  const [values, setValues] = useState<LeadFormValues>({
    name: lead.name,
    phone: lead.phone,
    email: lead.email ?? "",
    persona: lead.persona ?? "",
    college: lead.college ?? "",
    city: lead.city ?? "",
    source: lead.source,
    course_id: lead.course_id ?? "",
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Keep a deactivated course visible if this lead already has it.
  const options = courses.filter((c) => c.active || c.id === lead.course_id)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const problem = validateLeadForm(values)
    if (problem) return setError(problem)
    setBusy(true)
    const res = await updateLeadDetails(lead.id, leadPayload(values))
    setBusy(false)
    if (!res.ok) return setError(res.error)
    toast.success("Lead saved")
    router.refresh()
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={save} className="space-y-6" noValidate>
          <DialogHeader>
            <DialogTitle>Edit lead</DialogTitle>
          </DialogHeader>
          <LeadFormFields values={values} onChange={setValues} courses={options} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AskHelpDialog({
  leadId,
  leadName,
  goesTo,
  onClose,
}: {
  leadId: string
  leadName: string
  goesTo: "leader" | "admins"
  onClose: () => void
}) {
  const who = goesTo === "leader" ? "your pod leader" : "the admins"
  const router = useRouter()
  const [reason, setReason] = useState<(typeof HELP_REASONS)[number] | "">("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask for help</DialogTitle>
          <DialogDescription>
            {leadName} · {goesTo === "leader" ? "Your pod leader" : "The admins"} get notified.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="What do you need?">
          {HELP_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-sm font-medium",
                reason === r ? "border-brand bg-brand-soft text-brand" : "bg-white hover:bg-muted"
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <Textarea
          aria-label="Note"
          rows={3}
          maxLength={1000}
          placeholder="What’s happening? e.g. Father wants to talk about placement support."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            disabled={busy || !reason}
            onClick={async () => {
              setBusy(true)
              const res = await askForHelp(leadId, { reason, note })
              setBusy(false)
              if (!res.ok) return setError(res.error)
              toast.success(`Sent to ${who}`)
              router.refresh()
              onClose()
            }}
          >
            Send to {who}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FollowUpDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const router = useRouter()
  const [value, setValue] = useState(lead.next_follow_up ?? "")
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Next follow-up</DialogTitle>
          <DialogDescription>{lead.name}</DialogDescription>
        </DialogHeader>
        <FollowUpPicker id="fu-date" value={value} onChange={setValue} />
        <DialogFooter>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const res = await setFollowUp(lead.id, value || null)
              setBusy(false)
              if (!res.ok) return void toast.error(res.error)
              toast.success("Follow-up saved")
              router.refresh()
              onClose()
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

