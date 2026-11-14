import { requirePerm } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { CourseForm } from "../course-form"

export const metadata = { title: "Add course · Azisly BD CRM" }

export default async function NewCoursePage() {
  await requirePerm("courses")
  return (
    <>
      <PageHeader title="Add course" />
      <CourseForm course={null} />
    </>
  )
}
