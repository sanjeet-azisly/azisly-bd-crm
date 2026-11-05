import Link from "next/link"
import {
  BadgeCheck,
  BookOpen,
  ChevronRight,
  Crown,
  Flag,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  SlidersHorizontal,
  Trophy,
  Users,
  UsersRound,
  Waves,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "Admin · Azisly BD CRM" }

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard", hint: "Revenue vs targets, funnel, CSV", icon: LayoutDashboard },
  { href: "/admin/verify", label: "Verify payments", hint: "Pending payments, oldest first", icon: BadgeCheck },
  { href: "/admin/flags", label: "Flagged leads", hint: "Attempts to add numbers already in the CRM", icon: Flag },
  { href: "/pod", label: "Pod view", hint: "Any pod’s members, help queue, stuck deals", icon: Crown },
  { href: "/pool", label: "Pool", hint: "Untouched leads across all pods", icon: Waves },
  { href: "/leaderboard", label: "Leaderboard", hint: "Individuals and pods", icon: Trophy },
  { href: "/admin/team", label: "Team", hint: "Invite, roles, pods, access", icon: Users },
  { href: "/admin/photos", label: "ID photos", hint: "Passport photos for ID cards, download all", icon: IdCard },
  { href: "/admin/pods", label: "Pods", hint: "Create pods, mark leaders", icon: UsersRound },
  { href: "/courses", label: "Courses hub", hint: "What interns see, and your own course links", icon: GraduationCap },
  { href: "/admin/courses", label: "Course setup", hint: "Prices, pitch, payment links", icon: BookOpen },
  { href: "/admin/settings", label: "Settings", hint: "Dates, milestones, slabs, targets, pool", icon: SlidersHorizontal },
]

export default function AdminHub() {
  return (
    <>
      <PageHeader title="Admin" />
      <ul className="divide-y rounded-2xl bg-surface">
        {LINKS.map(({ href, label, hint, icon: Icon }) => (
          <li key={href}>
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
