import { Chip } from "@/components/chip"
import { STAGE_TONE, TEMPERATURE_TONE, TOUCH_LIMIT, type Stage, type Temperature } from "@/lib/leads"

export function TempChip({ temperature }: { temperature: Temperature }) {
  return <Chip tone={TEMPERATURE_TONE[temperature]}>{temperature}</Chip>
}

export function TouchesChip({ touches }: { touches: number }) {
  return (
    <Chip tone={touches >= TOUCH_LIMIT ? "amber" : "grey"}>
      {Math.min(touches, TOUCH_LIMIT)}/{TOUCH_LIMIT} touches
    </Chip>
  )
}

export function StageChip({ stage }: { stage: Stage }) {
  return <Chip tone={STAGE_TONE[stage] ?? "grey"}>{stage}</Chip>
}

const STAGE_DOT: Record<string, string> = {
  violet: "bg-[#7c3aed]",
  teal: "bg-[#0d9488]",
  pink: "bg-[#db2777]",
  amber: "bg-[#d97706]",
  green: "bg-[#16a34a]",
  red: "bg-[#dc2626]",
  grey: "bg-[#9ca3af]",
}

/** Quiet version of the stage for dense lists: coloured dot + grey text. */
export function StageDot({ stage }: { stage: Stage }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`size-2 rounded-full ${STAGE_DOT[STAGE_TONE[stage]] ?? "bg-[#9ca3af]"}`} aria-hidden />
      {stage}
    </span>
  )
}
