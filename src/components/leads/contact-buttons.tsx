import { MessageCircle, Phone } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { callUrl, whatsappUrl } from "@/lib/leads"
import { cn } from "@/lib/utils"

/** One-tap WhatsApp and Call. WhatsApp opens with a short greeting prefilled. */
export function ContactButtons({
  phone,
  greeting,
  size = "sm",
}: {
  phone: string
  greeting?: string
  size?: "sm" | "default"
}) {
  const cls = buttonVariants({ size: size === "sm" ? "icon-sm" : "default" })
  return (
    <div className="flex gap-1.5">
      <a
        href={whatsappUrl(phone, greeting)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp"
        title="WhatsApp"
        className={cn(cls, "border-0 bg-whatsapp text-white hover:bg-[#1ebe5b]")}
      >
        <MessageCircle /> {size !== "sm" && "WhatsApp"}
      </a>
      <a href={callUrl(phone)} aria-label="Call" title="Call" className={cn(cls, "border-0 bg-brand-soft text-brand hover:bg-[#dde4fd]")}>
        <Phone /> {size !== "sm" && "Call"}
      </a>
    </div>
  )
}
