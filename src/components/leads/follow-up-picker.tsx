"use client"

import { Input } from "@/components/ui/input"
import { addDays, istDate } from "@/lib/leads"
import { cn } from "@/lib/utils"

/** Quick follow-up choices plus a date field. Empty value = no follow-up. */
export function FollowUpPicker({
  value,
  onChange,
  id,
  allowNone = true,
}: {
  value: string
  onChange: (v: string) => void
  id: string
  allowNone?: boolean
}) {
  const today = istDate()
  const quick = [
    { label: "Today", date: today },
    { label: "Tomorrow", date: addDays(today, 1) },
    { label: "In 3 days", date: addDays(today, 3) },
    { label: "In a week", date: addDays(today, 7) },
  ]
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => onChange(q.date)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              value === q.date ? "border-brand bg-brand text-white" : "bg-white hover:bg-muted"
            )}
          >
            {q.label}
          </button>
        ))}
        {allowNone && (
          <button
            type="button"
            onClick={() => onChange("")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              value === "" ? "border-brand bg-brand text-white" : "bg-white hover:bg-muted"
            )}
          >
            None
          </button>
        )}
      </div>
      <Input id={id} type="date" value={value} min={today} onChange={(e) => onChange(e.target.value)} className="h-10" />
    </div>
  )
}
