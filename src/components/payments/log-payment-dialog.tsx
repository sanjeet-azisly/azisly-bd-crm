"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { logPayment } from "@/app/(app)/payments/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { formatINR } from "@/lib/format"
import { istDate } from "@/lib/leads"
import { shrinkImage } from "./shrink-image"

export type PaymentCourse = { id: string; name: string; offer_price: number; installments_allowed: boolean }

export function LogPaymentDialog({
  leadId,
  leadName,
  courses,
  defaultCourseId,
  assistOptions,
  onClose,
}: {
  leadId: string
  leadName: string
  courses: PaymentCourse[]
  defaultCourseId: string | null
  assistOptions: { id: string; full_name: string }[]
  onClose: () => void
}) {
  const router = useRouter()
  const first = courses.find((c) => c.id === defaultCourseId) ?? courses[0]
  const [courseId, setCourseId] = useState(first?.id ?? "")
  const [amount, setAmount] = useState(first ? String(first.offer_price) : "")
  const [paidOn, setPaidOn] = useState(istDate())
  const [txn, setTxn] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [assisted, setAssisted] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const course = courses.find((c) => c.id === courseId)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const clean = amount.replace(/[,\s₹]/g, "")
    if (!/^\d+(\.\d{1,2})?$/.test(clean) || Number(clean) <= 0) return setError("Enter the amount.")
    if (txn.trim().length < 3) return setError("Enter the transaction / reference ID.")
    setBusy(true)
    const form = new FormData()
    form.set("lead_id", leadId)
    form.set("course_id", courseId)
    form.set("amount", clean)
    form.set("paid_on", paidOn)
    form.set("txn_ref", txn)
    form.set("assisted_by", assisted)
    if (file) form.set("screenshot", await shrinkImage(file))
    const res = await logPayment(form)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    toast.success("Payment logged – pending verification")
    router.refresh()
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <form onSubmit={save} className="space-y-6" noValidate>
          <DialogHeader>
            <DialogTitle>Log payment</DialogTitle>
            <DialogDescription>
              {leadName} · It counts once an admin verifies it. Only payments through the official Azisly link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="pay-course">Course</Label>
            <NativeSelect
              id="pay-course"
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value)
                const c = courses.find((x) => x.id === e.target.value)
                if (c) setAmount(String(c.offer_price))
              }}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {formatINR(c.offer_price)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Amount (₹)</Label>
              <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Payment date</Label>
              <Input id="pay-date" type="date" max={istDate()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
          </div>
          {course?.installments_allowed && (
            <p className="-mt-2 text-xs text-muted-foreground">Installments allowed: enter just this installment’s amount.</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pay-txn">Transaction / reference ID</Label>
            <Input
              id="pay-txn"
              value={txn}
              maxLength={100}
              autoComplete="off"
              placeholder="e.g. UPI ref 4123 5678 9012"
              onChange={(e) => setTxn(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-shot">Screenshot (optional)</Label>
            <Input
              id="pay-shot"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="h-auto py-2"
            />
          </div>
          {assistOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="pay-assist">Assisted by (optional)</Label>
              <NativeSelect id="pay-assist" value={assisted} onChange={(e) => setAssisted(e.target.value)}>
                <option value="">No one</option>
                {assistOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">Shown as a tag. The full sale is still credited to the lead owner.</p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" className="h-10" disabled={busy}>
              {busy ? "Saving…" : "Log payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
