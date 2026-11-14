import Link from "next/link"
import { AlertTriangle, ChevronRight, Pencil } from "lucide-react"
import { Chip } from "@/components/chip"
import { PageHeader } from "@/components/page-header"
import { buttonVariants } from "@/components/ui/button"
import { requireUser } from "@/lib/auth"
import { formatINR, isPlaceholder } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"
import type { Course } from "@/lib/types"
import { SellingRules } from "./selling-rules"

export const metadata = { title: "Courses · Azisly BD CRM" }

export default async function CoursesHub() {
  const me = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase.from("courses").select("*").eq("active", true).order("sort_order").order("offer_price")
  const courses = (data ?? []) as Course[]

  return (
    <>
      <PageHeader title="Courses" description="Know the value, then share your personal course page." />
      <ul className="grid gap-5 sm:grid-cols-2">
        {courses.map((c) => (
          <li key={c.id} className="relative flex flex-col rounded-2xl bg-surface p-6 hover:border-brand">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {/* The whole card opens the course; the link stretches over it. */}
                <Link href={`/courses/${c.slug}`} className="after:absolute after:inset-0">
                  {c.name}
                </Link>
              </h2>
              <Chip tone={c.tier === "Premium" ? "violet" : c.tier === "Core" ? "brand" : "grey"}>{c.tier}</Chip>
            </div>
            {!isPlaceholder(c.one_line_value) && <p className="mt-1 text-sm text-muted-foreground">{c.one_line_value}</p>}
            <p className="mt-5 text-3xl font-semibold tracking-tight">
              {formatINR(c.offer_price)}{" "}
              {c.original_price !== null && (
                <span className="ml-1 text-base font-normal text-muted-foreground line-through">{formatINR(c.original_price)}</span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">Typical close: {isPlaceholder(c.typical_close) ? "–" : c.typical_close}</p>
            <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
              {isPlaceholder(c.pitch) ? (
                <span className="flex items-center gap-1 text-xs text-[#b45309]">
                  <AlertTriangle className="size-3.5" /> Pitch not written yet
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Pitch, objections & your link</span>
              )}
              <span className="flex items-center gap-2">
                {me.can("courses") && (
                  <Link
                    href={`/admin/courses/${c.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm", className: "relative z-10" })}
                  >
                    <Pencil /> Edit course
                  </Link>
                )}
                <ChevronRight className="size-4 text-muted-foreground" />
              </span>
            </div>
          </li>
        ))}
      </ul>
      {courses.length === 0 && <p className="text-sm text-muted-foreground">No active courses yet.</p>}

      <SellingRules />
    </>
  )
}
