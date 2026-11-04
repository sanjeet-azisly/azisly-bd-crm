import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BadgeCheck, Check } from "lucide-react"
import { Logo } from "@/components/logo"
import { sharedByLine } from "@/lib/courses"
import { formatINR, isPlaceholder } from "@/lib/format"
import { getPublicCourse, getReferrer } from "./data"
import { InterestForm } from "./interest-form"

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ ref?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const course = await getPublicCourse(slug)
  if (!course) return { title: "Azisly.ai" }
  const description = isPlaceholder(course.one_line_value) ? `${course.name} from Azisly.ai` : course.one_line_value
  // WhatsApp and LinkedIn use these for the link preview.
  return {
    title: `${course.name} · Azisly.ai`,
    description,
    openGraph: { title: course.name, description, siteName: "Azisly.ai", type: "website" },
  }
}

/** Spec 5.6: the prospect-facing course page. No login, no payment. */
export default async function PublicCoursePage({ params, searchParams }: Props) {
  const [{ slug }, { ref }] = await Promise.all([params, searchParams])
  const course = await getPublicCourse(slug)
  if (!course) notFound()
  const referrer = await getReferrer(ref)
  const discount =
    course.original_price && course.original_price > course.offer_price
      ? Math.round((1 - course.offer_price / course.original_price) * 100)
      : null

  return (
    <div className="min-h-dvh bg-background">
      <header className="bg-white px-4 pt-6 pb-12 text-center">
        <div className="mx-auto max-w-2xl">
          <Logo className="text-base [&>span:last-child]:hidden" />
          <h1 className="mt-12 text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">{course.name}</h1>
          {!isPlaceholder(course.one_line_value) && <p className="mt-4 text-xl text-muted-foreground">{course.one_line_value}</p>}
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
            <BadgeCheck className="size-4" /> {sharedByLine(referrer?.full_name ?? null)}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-6 pb-12">
        <section className="rounded-2xl bg-surface p-8 text-center">
          <p className="text-sm text-muted-foreground">Course fee</p>
          <p className="flex flex-wrap items-baseline justify-center gap-x-3">
            <span className="font-heading text-4xl font-semibold tracking-tight">{formatINR(course.offer_price)}</span>
            {course.original_price !== null && course.original_price > course.offer_price && (
              <span className="text-lg text-muted-foreground line-through">{formatINR(course.original_price)}</span>
            )}
            {discount && <span className="rounded-full bg-[#e1f6e8] px-2.5 py-0.5 text-sm font-medium text-[#15803d]">{discount}% off</span>}
          </p>
        </section>

        {!isPlaceholder(course.who_for) && (
          <section className="rounded-2xl bg-surface p-8">
            <h2 className="mb-2 text-lg font-semibold">Who it’s for</h2>
            <p className="whitespace-pre-wrap text-foreground/90">{course.who_for}</p>
          </section>
        )}

        {course.what_they_get.length > 0 && (
          <section className="rounded-2xl bg-surface p-8">
            <h2 className="mb-3 text-lg font-semibold">What you get</h2>
            <ul className="space-y-2.5">
              {course.what_they_get.map((g, i) => (
                <li key={i} className="flex gap-2.5">
                  <Check className="mt-0.5 size-5 shrink-0 text-[#16a34a]" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!isPlaceholder(course.proof) && (
          <section className="rounded-2xl bg-surface p-8">
            <h2 className="mb-2 text-lg font-semibold">Why trust it</h2>
            <p className="whitespace-pre-wrap text-foreground/90">{course.proof}</p>
          </section>
        )}

        <section id="interested" className="scroll-mt-4 rounded-2xl bg-surface p-8">
          <h2 className="text-2xl font-semibold">I’m interested</h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Leave your details and {referrer ? referrer.full_name.split(" ")[0] : "our team"} from Azisly.ai will get in touch.
          </p>
          <InterestForm slug={course.slug} refCode={referrer ? ref : undefined} />
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Payments are only ever made through the official Azisly.ai payment link. © Azisly.ai
        </p>
      </main>
    </div>
  )
}
