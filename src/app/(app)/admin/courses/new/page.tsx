import { PageHeader } from "@/components/page-header"
import { CourseForm } from "../course-form"

export const metadata = { title: "Add course · Azisly BD CRM" }

export default function NewCoursePage() {
  return (
    <>
      <PageHeader title="Add course" />
      <CourseForm course={null} />
    </>
  )
}
