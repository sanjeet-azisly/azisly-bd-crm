import { firstName } from "@/lib/format"
import type { Course } from "@/lib/types"

/** Spec 5.5.3: the prefilled WhatsApp message. */
export function whatsappShareText(course: Pick<Course, "name" | "one_line_value">, link: string) {
  const value = course.one_line_value?.trim()
  return `Hi! Here’s the ${course.name} from Azisly.ai${value ? ` – ${value}` : ""}. Details: ${link}`
}

export function sharedByLine(fullName: string | null) {
  return fullName ? `Shared by ${firstName(fullName)}, Azisly.ai` : "Shared by Azisly.ai"
}
