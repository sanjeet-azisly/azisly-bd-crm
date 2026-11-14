import { requirePerm } from "@/lib/auth"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Chip } from "@/components/chip"
import { PageHeader } from "@/components/page-header"
import { buttonVariants } from "@/components/ui/button"
import { formatINR } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"
import type { Course } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ActiveToggle } from "./active-toggle"

export const metadata = { title: "Courses · Azisly BD CRM" }

export default async function CoursesAdminPage() {
  await requirePerm("courses")
  const supabase = await createClient()
  const { data } = await supabase
    .from("courses")
    .select("*")
    .order("active", { ascending: false })
    .order("sort_order")
    .order("offer_price")
  const courses = (data ?? []) as Course[]

  return (
    <>
      <PageHeader
        title="Course setup"
        description="What interns sell. Inactive courses are hidden from interns and prospects."
        action={
          <Link href="/admin/courses/new" className={cn(buttonVariants(), "h-10")}>
            <Plus /> Add course
          </Link>
        }
      />
      <ul className="grid gap-5 sm:grid-cols-2">
        {courses.map((c) => (
          <li key={c.id} className={cn("flex flex-col rounded-2xl bg-surface p-6", !c.active && "opacity-60")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-semibold">{c.name}</h2>
                <p className="text-xs text-muted-foreground">Shown in lists as “{c.short_name}”</p>
              </div>
              <Chip tone={c.tier === "Premium" ? "violet" : c.tier === "Core" ? "brand" : "grey"}>{c.tier}</Chip>
            </div>
            <p className="mt-3 text-lg font-semibold">
              {formatINR(c.offer_price)}{" "}
              {c.original_price !== null && (
                <span className="text-sm font-normal text-muted-foreground line-through">{formatINR(c.original_price)}</span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">Typical close: {c.typical_close || "–"}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.installments_allowed && <Chip>Installments</Chip>}
              {!c.payment_url && <Chip tone="amber">No payment link yet</Chip>}
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
              <ActiveToggle id={c.id} active={c.active} />
              <Link href={`/admin/courses/${c.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Edit course
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {courses.length === 0 && <p className="text-sm text-muted-foreground">No courses yet.</p>}
    </>
  )
}
