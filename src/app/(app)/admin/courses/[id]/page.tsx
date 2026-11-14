import { requirePerm } from "@/lib/auth"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { createClient } from "@/lib/supabase/server"
import type { Course } from "@/lib/types"
import { CourseForm } from "../course-form"

export const metadata = { title: "Edit course · Azisly BD CRM" }

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("courses")
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("courses").select("*").eq("id", id).maybeSingle<Course>()
  if (!data) notFound()
  return (
    <>
      <PageHeader title={`Edit ${data.short_name}`} />
      <CourseForm course={data} />
    </>
  )
}
