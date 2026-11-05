"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { requestNewPhoto } from "./actions"

const QUICK = ["Background isn’t plain", "Face isn’t clear", "Not a formal photo", "Photo is blurry"]

/** Removes the photo and notifies the intern, with an optional reason. */
export function RequestNewPhoto({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  async function send() {
    setBusy(true)
    const res = await requestNewPhoto({ id, reason })
    setBusy(false)
    if (!res.ok) return toast.error(res.error)
    toast.success(`${name.split(" ")[0]} will be asked for a new photo.`)
    setOpen(false)
    setReason("")
    router.refresh()
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Ask again
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ask {name} for a new photo?</DialogTitle>
            <DialogDescription>
              Their current photo is removed and they get a notification to upload a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setReason(q)}
                className="rounded-full bg-muted px-3 py-1.5 text-xs hover:bg-brand-soft hover:text-brand"
              >
                {q}
              </button>
            ))}
          </div>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional) – they’ll see this"
            maxLength={200}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={send} disabled={busy}>
              {busy ? "Sending…" : "Ask for new photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
