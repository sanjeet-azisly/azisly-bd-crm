import { cn } from "@/lib/utils"

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("font-heading text-lg font-semibold tracking-tight whitespace-nowrap", light ? "text-white" : "text-foreground", className)}>
      Azisly<span className={light ? "text-white/60" : "text-muted-foreground"}>.ai</span>{" "}
      <span className={cn("font-normal", light ? "text-white/60" : "text-muted-foreground")}>BD CRM</span>
    </span>
  )
}
