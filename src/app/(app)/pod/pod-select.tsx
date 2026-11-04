"use client"

import { useRouter } from "next/navigation"
import { NativeSelect } from "@/components/ui/native-select"

/** Admins pick which pod to look at. */
export function NativeSelectNav({ value, options }: { value: string; options: { value: string; label: string }[] }) {
  const router = useRouter()
  return (
    <div className="w-48">
      <NativeSelect aria-label="Pod" value={value} onChange={(e) => router.push(`/pod?pod=${e.target.value}`)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  )
}
