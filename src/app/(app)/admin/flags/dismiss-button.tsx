"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { dismissFlags } from "./actions"

export function DismissButton({ ids, label = "Dismiss" }: { ids: string[]; label?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        const res = await dismissFlags(ids)
        setBusy(false)
        if (!res.ok) return void toast.error(res.error)
        toast.success("Flag dismissed")
        router.refresh()
      }}
    >
      {label}
    </Button>
  )
}
