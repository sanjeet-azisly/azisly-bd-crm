"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { logTouch } from "@/app/(app)/leads/actions"
import { SEVEN_TOUCH_BANNER, TOUCH_LIMIT, TOUCH_TYPES, addDays, istDate, type TouchType } from "@/lib/leads"
import { cn } from "@/lib/utils"
import { FollowUpPicker } from "./follow-up-picker"

export function LogTouchDialog({
  leadId,
  leadName,
  open,
  onOpenChange,
  initialType = "call",
}: {
  leadId: string
  leadName: string
  open: boolean
  onOpenChange: (o: boolean) => void
  initialType?: TouchType
}) {
  const router = useRouter()
  const [type, setType] = useState<TouchType>(initialType)
  const [note, setNote] = useState("")
  const [next, setNext] = useState(addDays(istDate(), 1))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (type === "note" && !note.trim()) return setError("Write the note.")
    setBusy(true)
    const res = await logTouch(leadId, { type, note, next_follow_up: next || null })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    toast.success("Touch logged")
    if (res.data && res.data.touches >= TOUCH_LIMIT) toast.warning(SEVEN_TOUCH_BANNER, { duration: 8000 })
    setNote("")
    setNext(addDays(istDate(), 1))
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={save} className="space-y-6" noValidate>
          <DialogHeader>
            <DialogTitle>Log touch</DialogTitle>
            <DialogDescription>{leadName}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="What did you do?">
            {TOUCH_TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                role="radio"
                aria-checked={type === t.type}
                onClick={() => setType(t.type)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm font-medium",
                  type === t.type ? "border-brand bg-brand-soft text-brand" : "bg-white hover:bg-muted"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="touch-note">{type === "note" ? "Note" : "Note (optional)"}</Label>
            <Textarea
              id="touch-note"
              rows={3}
              maxLength={2000}
              placeholder="What happened? What did they say?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="touch-next">Next follow-up</Label>
            <FollowUpPicker id="touch-next" value={next} onChange={setNext} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" className="h-10" disabled={busy}>
              {busy ? "Saving…" : "Save touch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** A "Log touch" button that opens the dialog. */
export function LogTouchButton({
  leadId,
  leadName,
  size = "sm",
  variant = "default",
  label = "Log touch",
}: {
  leadId: string
  leadName: string
  size?: "sm" | "default"
  variant?: "default" | "outline"
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && <LogTouchDialog leadId={leadId} leadName={leadName} open={open} onOpenChange={setOpen} />}
    </>
  )
}
