"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { setCourseActive } from "./actions"

export function ActiveToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch
        checked={active}
        disabled={busy}
        onCheckedChange={async (next) => {
          setBusy(true)
          const res = await setCourseActive(id, next)
          setBusy(false)
          if (!res.ok) return toast.error(res.error)
          toast.success(next ? "Course is active" : "Course deactivated")
          router.refresh()
        }}
      />
      {active ? "Active" : "Inactive"}
    </label>
  )
}
