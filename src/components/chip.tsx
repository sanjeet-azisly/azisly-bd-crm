import { cn } from "@/lib/utils"

// Soft pastel tags (light tint + deep text of the same hue), like the reference designs.
const TONES = {
  red: "bg-[#fdecea] text-[#b42318]",
  amber: "bg-[#fdf1d6] text-[#8a5300]",
  blue: "bg-[#e5eefe] text-[#1d4ed8]",
  green: "bg-[#e1f6e8] text-[#15803d]",
  teal: "bg-[#ddf4f1] text-[#0f766e]",
  violet: "bg-[#efe9fe] text-[#6d28d9]",
  pink: "bg-[#fce7f3] text-[#be185d]",
  grey: "bg-[#efeff2] text-[#55555b]",
  brand: "bg-[#eaeefe] text-[#2346F5]",
  navy: "bg-foreground text-background",
} as const

export type ChipTone = keyof typeof TONES

export function Chip({ tone = "grey", className, children }: { tone?: ChipTone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
