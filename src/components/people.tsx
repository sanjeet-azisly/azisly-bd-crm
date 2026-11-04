import { cn } from "@/lib/utils"

/** Round initials avatar, tinted with the person's pod colour when there is one. */
export function Avatar({ name, colour, className }: { name: string; colour?: string | null; className?: string }) {
  const initials = name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
  return (
    <span
      aria-hidden
      className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold", className)}
      style={
        colour
          ? { background: `${colour}1f`, color: colour }
          : { background: "#eaeefe", color: "#2346F5" }
      }
    >
      {initials || "?"}
    </span>
  )
}

const MEDALS: Record<number, string> = {
  1: "bg-[#fff1c2] text-[#9a6a00] ring-[#f5d76e]",
  2: "bg-[#eef0f4] text-[#4b5563] ring-[#d5d9e0]",
  3: "bg-[#fbe5d6] text-[#9a4a16] ring-[#efc2a2]",
}

/** Rank number; the top three get gold, silver and bronze. */
export function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold",
        MEDALS[rank] ? `ring-1 ${MEDALS[rank]}` : "text-muted-foreground"
      )}
    >
      {rank}
    </span>
  )
}
