import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react"
import { Chip } from "@/components/chip"
import { buttonVariants } from "@/components/ui/button"
import { requireUser } from "@/lib/auth"
import { formatINR, isPlaceholder } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"
import type { Course } from "@/lib/types"
import { SellingRules } from "../selling-rules"
import { ShareBlock } from "./share-block"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("courses").select("short_name").eq("slug", slug).maybeSingle()
  return { title: `${data?.short_name ?? "Course"} · Azisly BD CRM` }
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const me = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase.from("courses").select("*").eq("slug", slug).maybeSingle<Course>()
  if (!data || (!data.active && !me.can("courses"))) notFound()
  const c = data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/courses" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Courses
        </Link>
        {me.can("courses") && (
          <Link href={`/admin/courses/${c.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Pencil /> Edit course
          </Link>
        )}
      </div>

      <header className="rounded-2xl bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-2xl font-semibold">{c.name}</h1>
          <Chip tone={c.tier === "Premium" ? "violet" : c.tier === "Core" ? "brand" : "grey"}>{c.tier}</Chip>
        </div>
        {!isPlaceholder(c.one_line_value) && <p className="mt-1 text-muted-foreground">{c.one_line_value}</p>}
        <p className="mt-3 text-2xl font-semibold">
          {formatINR(c.offer_price)}{" "}
          {c.original_price !== null && (
            <span className="text-base font-normal text-muted-foreground line-through">{formatINR(c.original_price)}</span>
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          Typical close: {isPlaceholder(c.typical_close) ? "–" : c.typical_close}
          {c.installments_allowed && " · Installments allowed"}
        </p>
      </header>

      <ShareBlock course={{ name: c.name, slug: c.slug, one_line_value: c.one_line_value }} referralCode={me.profile.referral_code} />

      <Section title="Who it’s for" text={c.who_for} />
      <section className="rounded-2xl bg-surface p-6">
        <h2 className="mb-2 font-semibold">What they get</h2>
        {c.what_they_get.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {c.what_they_get.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        ) : (
          <Missing />
        )}
      </section>
      <Section title="Proof" text={c.proof} />
      <Section title="60-second pitch" text={c.pitch} highlight />
      <section className="rounded-2xl bg-surface p-6">
        <h2 className="mb-2 font-semibold">Objections</h2>
        {c.objections.length ? (
          <ul className="divide-y rounded-lg border">
            {c.objections.map((o, i) => (
              <li key={i}>
                <details className="px-3 py-2.5 text-sm">
                  <summary className="cursor-pointer font-medium">“{o.q}”</summary>
                  <p className="mt-1.5 whitespace-pre-wrap text-muted-foreground">{o.a}</p>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <Missing />
        )}
      </section>
      {c.brochure_url && (
        <a
          href={c.brochure_url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", className: "h-10 w-full" })}
        >
          <ExternalLink /> Open brochure
        </a>
      )}
      <SellingRules />
    </div>
  )
}

function Section({ title, text, highlight = false }: { title: string; text: string; highlight?: boolean }) {
  return (
    <section className={highlight ? "rounded-xl border border-brand/30 bg-brand-soft p-4" : "rounded-2xl bg-surface p-6"}>
      <h2 className="mb-2 font-semibold">{title}</h2>
      {isPlaceholder(text) ? <Missing /> : <p className="text-sm whitespace-pre-wrap">{text}</p>}
    </section>
  )
}

function Missing() {
  return <p className="text-sm text-[#b45309]">Not written yet – an admin needs to fill this in.</p>
}
