import Link from "next/link"
import { redirect } from "next/navigation"
import { Calculator, ChevronRight, GraduationCap, Trophy, Waves } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { requireUser } from "@/lib/auth"
import { NAV_ITEMS, navViewer } from "@/lib/nav"

export const metadata = { title: "Admin · Azisly BD CRM" }

// Screens that don't fit the phone bar.
const EXTRA = [
  { href: "/courses", label: "Courses hub", hint: "What interns see, and your own course links", icon: GraduationCap },
  { href: "/leaderboard", label: "Leaderboard", hint: "Individuals and pods", icon: Trophy },
  { href: "/pool", label: "Pool", hint: "Untouched leads you can claim", icon: Waves },
  { href: "/earnings", label: "Earnings calculator", hint: "What sales would earn", icon: Calculator },
]

export default async function AdminHub() {
  const me = await requireUser()
  const viewer = navViewer(me)
  if (!NAV_ITEMS.some((i) => i.manage && i.show(viewer))) redirect("/today")
  const links = [
    ...NAV_ITEMS.filter((i) => i.manage && i.show(viewer)).map((i) => ({ href: i.href, label: i.label, hint: i.hint ?? "", icon: i.icon })),
    ...EXTRA.filter((e) => e.href !== "/pool" || viewer.inPod || viewer.isAdmin),
  ]
  return (
    <>
      <PageHeader title={me.isAdmin ? "Admin" : "Manage"} />
      <ul className="divide-y rounded-2xl bg-surface">
        {links.map(({ href, label, hint, icon: Icon }) => (
          <li key={`${href}-${label}`}>
            <Link href={href} className="flex items-center gap-3 p-4 hover:bg-muted/50">
              <Icon className="size-5 text-brand" />
              <span className="flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-muted-foreground">{hint}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
