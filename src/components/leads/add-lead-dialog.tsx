"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { createLead } from "@/app/(app)/leads/actions"
import { addDays, istDate } from "@/lib/leads"
import { FollowUpPicker } from "./follow-up-picker"
import {
  LeadFormFields,
  emptyLeadForm,
  leadPayload,
  validateLeadForm,
  type CourseOption,
  type LeadFormValues,
} from "./lead-form-fields"

export function AddLeadButton({
  courses,
  isAdmin,
  className,
  label = "Add lead",
}: {
  courses: CourseOption[]
  isAdmin: boolean
  className?: string
  label?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<LeadFormValues>(emptyLeadForm)
  const [next, setNext] = useState(addDays(istDate(), 1))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dupId, setDupId] = useState<string | null>(null)

  function close() {
    setOpen(false)
    setValues(emptyLeadForm)
    setNext(addDays(istDate(), 1))
    setError(null)
    setDupId(null)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDupId(null)
    const problem = validateLeadForm(values)
    if (problem) return setError(problem)
    setBusy(true)
    const res = await createLead({ ...leadPayload(values), next_follow_up: next || null })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      setDupId(res.duplicateLeadId ?? null)
      return
    }
    toast.success("Lead added")
    close()
    router.refresh()
  }

  return (
    <>
      <Button className={className} onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <form onSubmit={save} className="space-y-6" noValidate>
            <DialogHeader>
              <DialogTitle>Add lead</DialogTitle>
              <DialogDescription>Every number can only be in the CRM once.</DialogDescription>
            </DialogHeader>
            <LeadFormFields values={values} onChange={setValues} courses={courses} />
            <div className="space-y-1.5">
              <Label htmlFor="lead-next">Next follow-up</Label>
              <FollowUpPicker id="lead-next" value={next} onChange={setNext} />
            </div>
            {error && (
              <div role="alert" className="space-y-1 rounded-xl bg-[#fdecea] px-4 py-3 text-sm text-[#b42318]">
                <p>{error}</p>
                {/* Admins can open the existing lead and reassign it. */}
                {dupId && isAdmin && (
                  <Link href={`/leads/${dupId}`} className="font-medium underline" onClick={close}>
                    Open that lead (admin can reassign it)
                  </Link>
                )}
              </div>
            )}
            <DialogFooter>
              <Button type="submit" className="h-10" disabled={busy}>
                {busy ? "Saving…" : "Save lead"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
