import Link from "next/link"
import { Camera, Download } from "lucide-react"
import { Chip } from "@/components/chip"
import { PageHeader } from "@/components/page-header"
import { requireAdmin } from "@/lib/auth"
import { photoLinks } from "@/lib/id-photos"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { RequestNewPhoto } from "./request-new-photo"

export const metadata = { title: "ID photos · Azisly BD CRM" }

type Person = {
  id: string
  full_name: string
  photo_path: string | null
  photo_updated_at: string | null
  pod: { name: string; colour: string } | null
}

const TABS = [
  { key: "all", label: "Everyone" },
  { key: "missing", label: "Missing" },
  { key: "uploaded", label: "Uploaded" },
] as const

export default async function PhotosPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin()
  const { show: raw } = await searchParams
  const show = TABS.some((t) => t.key === raw) ? raw! : "all"

  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, photo_path, photo_updated_at, pod:pods!profiles_pod_id_fkey(name, colour)")
    .eq("active", true)
    .eq("role", "intern")
    .order("full_name")
  const everyone = (data ?? []) as unknown as Person[]
  const uploaded = everyone.filter((p) => p.photo_path).length
  const people = everyone.filter((p) => (show === "missing" ? !p.photo_path : show === "uploaded" ? !!p.photo_path : true))
  // Missing first, so the follow-up list is at the top.
  if (show === "all") people.sort((a, b) => Number(!!a.photo_path) - Number(!!b.photo_path))
  const links = await photoLinks(people.map((p) => p.photo_path))

  return (
    <>
      <PageHeader
        title="ID photos"
        description={`${uploaded} of ${everyone.length} interns have uploaded a passport-size photo for their ID card.`}
        action={
          uploaded > 0 && (
            // A file download, not a page, so a plain link.
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a
              href="/admin/photos/download"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              <Download className="size-4" /> Download all ({uploaded})
            </a>
          )
        }
      />

      <nav className="mb-8 flex gap-1 rounded-full bg-surface p-1 text-sm" aria-label="Photo status">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/photos?show=${t.key}`}
            className={cn(
              "flex-1 rounded-full px-4 py-2 text-center",
              show === t.key ? "bg-brand-soft font-medium text-brand" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.key === "missing" && everyone.length - uploaded > 0 && ` (${everyone.length - uploaded})`}
          </Link>
        ))}
      </nav>

      {people.length === 0 ? (
        <p className="rounded-2xl bg-surface p-8 text-center text-sm text-muted-foreground">
          {show === "missing" ? "Everyone has uploaded a photo." : "No photos here yet."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {people.map((p) => {
            const url = p.photo_path ? links[p.photo_path] : null
            return (
              <li key={p.id} className="flex flex-col rounded-2xl bg-surface p-3">
                <div className="aspect-[35/45] overflow-hidden rounded-xl bg-[#f5f6f8]">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={p.full_name} className="size-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Camera className="size-6" />
                      <Chip tone="amber">Missing</Chip>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex-1 px-1">
                  <p className="truncate font-medium">{p.full_name}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    {p.pod && <span className="size-2 shrink-0 rounded-full" style={{ background: p.pod.colour }} />}
                    {p.pod?.name ?? "No pod"}
                  </p>
                </div>
                {p.photo_path && (
                  <div className="mt-3 flex items-center gap-1">
                    <a
                      href={`/admin/photos/download?id=${p.id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.85rem] font-medium hover:bg-muted"
                    >
                      <Download className="size-3.5" /> Download
                    </a>
                    <RequestNewPhoto id={p.id} name={p.full_name} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
