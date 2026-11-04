import { ShieldAlert } from "lucide-react"
import { SELLING_RULES } from "@/lib/format"

/** Spec 6.6, shown at the foot of the Courses hub. */
export function SellingRules() {
  return (
    <section className="mt-6 rounded-2xl bg-[#fdf1d6] p-6 text-sm text-[#5c3700]">
      <h2 className="mb-2 flex items-center gap-2 font-semibold">
        <ShieldAlert className="size-4" /> Selling rules
      </h2>
      <ul className="list-disc space-y-1 pl-5">
        {SELLING_RULES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>
  )
}
