"use client"

import { Copy, Link2, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { JoinLinkResult } from "./actions"

/** wa.me link that opens WhatsApp with the message ready (to their number when we have it). */
export function whatsappUrl(text: string, phone: string | null | undefined) {
  return `https://wa.me/${phone ? `91${phone}` : ""}?text=${encodeURIComponent(text)}`
}

export function WhatsAppButton({ text, phone, size = "default" }: { text: string; phone?: string | null; size?: "default" | "sm" }) {
  return (
    <a
      href={whatsappUrl(text, phone)}
      target="_blank"
      rel="noopener noreferrer"
      className={
        size === "sm"
          ? "inline-flex h-8 items-center gap-1.5 rounded-full bg-whatsapp px-3.5 text-[0.85rem] font-medium text-white hover:opacity-90"
          : "inline-flex h-10 items-center gap-2 rounded-full bg-whatsapp px-5 text-sm font-medium text-white hover:opacity-90"
      }
    >
      <MessageCircle className={size === "sm" ? "size-3.5" : "size-4"} /> WhatsApp
    </a>
  )
}

/** Shows a person's joining link with WhatsApp and copy buttons. */
export function ShareLinkDialog({
  share,
  title,
  onClose,
}: {
  share: JoinLinkResult | null
  title?: string
  onClose: () => void
}) {
  return (
    <Dialog open={!!share} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title ?? `Send ${share?.name.split(/\s+/)[0]} their link`}</DialogTitle>
          <DialogDescription>
            They open it, choose a password and they’re in. It works once and lasts 7 days – you can always make a new one
            from the Team page.
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-xl bg-muted p-4 text-sm break-words whitespace-pre-line">{share?.text}</p>
        <DialogFooter className="gap-2 sm:justify-start">
          {share && <WhatsAppButton text={share.text} phone={share.phone} />}
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(share?.text ?? "")
              toast.success("Message copied")
            }}
          >
            <Copy /> Copy message
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await navigator.clipboard.writeText(share?.link ?? "")
              toast.success("Link copied")
            }}
          >
            <Link2 /> Copy link only
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
