"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Hand } from "lucide-react"
import { toast } from "sonner"
import { claimLead } from "@/app/(app)/pod/actions"
import { Button } from "@/components/ui/button"

export function ClaimButton({ leadId, leadName }: { leadId: string; leadName: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <Button
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        const res = await claimLead(leadId)
        setBusy(false)
        if (!res.ok) return void toast.error(res.error)
        toast.success(`${leadName} is now yours`)
        router.push(`/leads/${leadId}`)
      }}
    >
      <Hand /> Claim
    </Button>
  )
}
