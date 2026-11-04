"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, ImageIcon, X } from "lucide-react"
import { toast } from "sonner"
import { refundPayment, rejectPayment, verifyPayment } from "@/app/(app)/payments/actions"
import { Chip } from "@/components/chip"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatINR } from "@/lib/format"
import { formatDateTime, formatDay } from "@/lib/leads"

export type QueueRow = {
  id: string
  amount: number
  paid_on: string
  txn_ref: string
  status: "Pending" | "Verified" | "Rejected" | "Refunded"
  reason: string | null
  logged_at: string
  lead_id: string
  lead_name: string
  intern: string
  course: string
  assisted: string | null
  screenshot_url: string | null
}

const TONE = { Pending: "amber", Verified: "green", Rejected: "red", Refunded: "grey" } as const

export function VerifyList({ rows, tab }: { rows: QueueRow[]; tab: "pending" | "verified" | "closed" }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [asking, setAsking] = useState<{ row: QueueRow; kind: "reject" | "refund" } | null>(null)

  async function verify(row: QueueRow) {
    setBusy(row.id)
    const res = await verifyPayment(row.id)
    setBusy(null)
    if (!res.ok) return void toast.error(res.error)
    toast.success("Payment verified")
    router.refresh()
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl bg-surface p-10 text-center text-sm text-muted-foreground">
        {tab === "pending" ? "Nothing to verify. 🎉" : "Nothing here yet."}
      </p>
    )
  }

  return (
    <>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl bg-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="font-heading text-xl font-semibold">{formatINR(r.amount)}</p>
                <p className="text-sm">
                  <span className="font-medium">{r.intern}</span> ·{" "}
                  <Link href={`/leads/${r.lead_id}`} className="text-brand underline-offset-2 hover:underline">
                    {r.lead_name}
                  </Link>{" "}
                  · {r.course}
                </p>
                <p className="text-sm text-muted-foreground">
                  Paid {formatDay(r.paid_on)} · Txn <span className="font-mono text-foreground">{r.txn_ref}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Logged {formatDateTime(r.logged_at)}
                  {r.assisted && <> · Assisted by {r.assisted}</>}
                </p>
                {r.reason && <p className="text-xs text-red-700">{r.reason}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                {tab !== "pending" && <Chip tone={TONE[r.status]}>{r.status}</Chip>}
                {r.screenshot_url ? (
                  <a href={r.screenshot_url} target="_blank" rel="noopener noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived private link */}
                    <img src={r.screenshot_url} alt="Payment screenshot" className="h-24 w-20 rounded-md border object-cover" />
                  </a>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ImageIcon className="size-3.5" /> No screenshot
                  </span>
                )}
              </div>
            </div>
            {tab === "pending" && (
              <div className="mt-3 flex gap-2 border-t pt-3">
                <Button className="flex-1 bg-[#16a34a] text-white hover:bg-[#15803d]" disabled={busy === r.id} onClick={() => verify(r)}>
                  <Check /> Verify
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => setAsking({ row: r, kind: "reject" })}>
                  <X /> Reject
                </Button>
              </div>
            )}
            {tab === "verified" && (
              <div className="mt-3 flex justify-end border-t pt-3">
                <Button variant="outline" size="sm" onClick={() => setAsking({ row: r, kind: "refund" })}>
                  Mark refunded
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {asking && (
        <ReasonDialog
          row={asking.row}
          kind={asking.kind}
          onClose={() => setAsking(null)}
          onDone={() => {
            setAsking(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}

function ReasonDialog({
  row,
  kind,
  onClose,
  onDone,
}: {
  row: QueueRow
  kind: "reject" | "refund"
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === "reject" ? "Reject payment" : "Mark as refunded"}</DialogTitle>
          <DialogDescription>
            {formatINR(row.amount)} · {row.lead_name} · {row.intern}.{" "}
            {kind === "reject" ? "The intern sees this reason." : "This sale will stop counting."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason</Label>
          <Textarea
            id="reason"
            rows={3}
            maxLength={500}
            placeholder={kind === "reject" ? "e.g. Transaction ID not found in the account" : "e.g. Refunded on request, 5 Dec"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              if (reason.trim().length < 3) return setError("Write a short reason.")
              setBusy(true)
              const res = kind === "reject" ? await rejectPayment(row.id, reason) : await refundPayment(row.id, reason)
              setBusy(false)
              if (!res.ok) return setError(res.error)
              toast.success(kind === "reject" ? "Payment rejected" : "Payment marked as refunded")
              onDone()
            }}
          >
            {kind === "reject" ? "Reject payment" : "Mark refunded"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
