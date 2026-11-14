import { Download, FileSpreadsheet } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { requirePerm } from "@/lib/auth"
import { REPORTS } from "@/lib/reports"

export const metadata = { title: "Excel reports · Azisly BD CRM" }

export default async function ReportsPage() {
  const me = await requirePerm("export")
  return (
    <>
      <PageHeader
        title="Excel reports"
        description={
          me.isAdmin
            ? "Download the whole CRM as Excel files to share with the business. Always up to the minute."
            : `Download ${me.ledPod?.name ?? "your pod"}’s data as Excel files.`
        }
      />
      <ul className="grid gap-4 sm:grid-cols-3">
        {Object.entries(REPORTS).map(([kind, r]) => (
          <li key={kind} className="flex flex-col rounded-2xl bg-surface p-6">
            <FileSpreadsheet className="size-6 text-[#15803d]" />
            <h2 className="mt-4 text-lg font-semibold">{r.title}</h2>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{r.hint}</p>
            {/* A file download, not a page, so a plain link. */}
            <a
              href={`/admin/reports/${kind}`}
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              <Download className="size-4" /> Download .xlsx
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}
