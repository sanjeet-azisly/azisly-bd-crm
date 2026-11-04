"use client"

import { useEffect, useState } from "react"
import { Copy, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { whatsappShareText } from "@/lib/courses"
import { courseLink } from "@/lib/leads"
import { cn } from "@/lib/utils"

/** Spec 5.5.3: the intern's personal course page link. */
export function ShareBlock({
  course,
  referralCode,
}: {
  course: { name: string; slug: string; one_line_value: string }
  referralCode: string | null
}) {
  const [link, setLink] = useState("")
  useEffect(() => setLink(courseLink(window.location.origin, course.slug, referralCode)), [course.slug, referralCode])
  const message = whatsappShareText(course, link)

  return (
    <section className="space-y-3 rounded-2xl bg-surface p-6">
      <div>
        <h2 className="font-semibold">Your course page</h2>
        <p className="text-sm text-muted-foreground">Leads who sign up through this link are added to your list automatically.</p>
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all">{link || "…"}</p>
      {!referralCode && (
        <p className="text-xs text-muted-foreground">You don’t have a referral code yet – ask your admin to set one.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          className="h-10"
          onClick={async () => {
            await navigator.clipboard.writeText(link)
            toast.success("Link copied")
          }}
        >
          <Copy /> Copy link
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants(), "h-10 bg-whatsapp text-white hover:bg-[#1ebe5b]")}
        >
          <MessageCircle /> Share on WhatsApp
        </a>
      </div>
    </section>
  )
}
