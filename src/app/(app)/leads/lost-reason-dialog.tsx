"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LOST_REASONS, type LostReason } from "@/lib/leads"
import { cn } from "@/lib/utils"

/** Lost needs a reason (spec 5.4.3). */
export function LostReasonDialog({
  leadName,
  onCancel,
  onConfirm,
}: {
  leadName: string
  onCancel: () => void
  onConfirm: (reason: LostReason) => void
}) {
  const [reason, setReason] = useState<LostReason | null>(null)
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Why was {leadName} lost?</DialogTitle>
          <DialogDescription>Pick one reason.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2" role="radiogroup" aria-label="Lost reason">
          {LOST_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left text-sm",
                reason === r ? "border-brand bg-brand-soft font-medium text-brand" : "bg-white hover:bg-muted"
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!reason} onClick={() => reason && onConfirm(reason)}>
            Mark as Lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
