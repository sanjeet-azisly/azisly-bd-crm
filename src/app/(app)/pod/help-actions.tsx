"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { markHelpHandled, takeHelp } from "./actions"

export function HelpActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    if (!res.ok) return void toast.error(res.error)
    toast.success(msg)
    router.refresh()
  }
  return (
    <span className="flex gap-1.5">
      {status === "Open" && (
        <Button size="sm" disabled={busy} onClick={() => run(() => takeHelp(id), "You’re on it")}>
          Take it
        </Button>
      )}
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => markHelpHandled(id), "Marked handled")}>
        Mark handled
      </Button>
    </span>
  )
}
