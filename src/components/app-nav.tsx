"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BadgeCheck,
  BookOpen,
  Contact,
  Crown,
  Flag,
  GraduationCap,
  IdCard,
  Home,
  LayoutDashboard,
  LayoutGrid,
  Settings2,
  SlidersHorizontal,
  Trophy,
  Users,
  UsersRound,
  Waves,
} from "lucide-react"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
  leaderOnly?: boolean
  /** Shown in the phone's bottom bar (the rest live on the Admin hub page). */
  bottom?: boolean
}

// Grows phase by phase as screens are added.
const ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: Home, bottom: true },
  { href: "/leads", label: "Leads", icon: Contact, bottom: true },
  { href: "/courses", label: "Courses", icon: GraduationCap, bottom: true },
  { href: "/leaderboard", label: "Ranks", icon: Trophy, bottom: true },
  { href: "/pod", label: "My pod", icon: Crown, leaderOnly: true, bottom: true },
  { href: "/pool", label: "Pool", icon: Waves },
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
  { href: "/admin/verify", label: "Verify", icon: BadgeCheck, adminOnly: true, bottom: true },
  { href: "/admin/flags", label: "Flagged leads", icon: Flag, adminOnly: true },
  { href: "/pod", label: "Pod view", icon: Crown, adminOnly: true },
  { href: "/admin/team", label: "Team", icon: Users, adminOnly: true },
  { href: "/admin/photos", label: "ID photos", icon: IdCard, adminOnly: true },
  { href: "/admin/pods", label: "Pods", icon: UsersRound, adminOnly: true },
  { href: "/admin/courses", label: "Course setup", icon: BookOpen, adminOnly: true },
  { href: "/admin/settings", label: "Settings", icon: SlidersHorizontal, adminOnly: true },
]

const ADMIN_HUB: NavItem = { href: "/admin", label: "Admin", icon: LayoutGrid, adminOnly: true, bottom: true }

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

type NavProps = { isAdmin: boolean; isLeader: boolean; inPod: boolean; pendingCount: number; flaggedCount?: number }

function visible(i: NavItem, { isAdmin, isLeader, inPod }: Pick<NavProps, "isAdmin" | "isLeader" | "inPod">) {
  if (i.adminOnly) return isAdmin
  if (i.leaderOnly) return isLeader && !isAdmin
  if (i.href === "/pool") return inPod || isAdmin
  return true
}

export function SideNav({ isAdmin, isLeader, inPod, pendingCount, flaggedCount = 0 }: NavProps) {
  const pathname = usePathname()
  const items = ITEMS.filter((i) => visible(i, { isAdmin, isLeader, inPod }))
  return (
    <nav className="space-y-0.5" aria-label="Main">
      {items.map(({ href, label, icon: Icon, adminOnly }, idx) => (
        <div key={href}>
          {adminOnly && !items[idx - 1]?.adminOnly && (
            <p className="mt-8 mb-2 flex items-center gap-1.5 px-4 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <Settings2 className="size-3" /> Admin
            </p>
          )}
          <Link
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-full px-4 py-2.5 text-[0.95rem] text-foreground/75 hover:bg-black/[0.04] hover:text-foreground",
              isActive(pathname, href) && "bg-brand-soft font-medium text-brand"
            )}
          >
            <Icon className="size-4" /> {label === "Ranks" ? "Leaderboard" : label}
            {href === "/admin/verify" && pendingCount > 0 && (
              <span className="ml-auto rounded-full bg-brand px-2 text-xs font-semibold text-white">{pendingCount}</span>
            )}
            {href === "/admin/flags" && flaggedCount > 0 && (
              <span className="ml-auto rounded-full bg-[#ff3b30] px-2 text-xs font-semibold text-white">{flaggedCount}</span>
            )}
          </Link>
        </div>
      ))}
    </nav>
  )
}

export function BottomNav({ isAdmin, isLeader, inPod, pendingCount }: NavProps) {
  const pathname = usePathname()
  // Admins have more screens: on their phone bar Courses moves to the Admin hub, keeping 5 items.
  const items = [...ITEMS, ADMIN_HUB].filter(
    (i) => i.bottom && visible(i, { isAdmin, isLeader, inPod }) && !(isAdmin && i.href === "/courses")
  )
  // The Admin hub is "active" on any admin page that isn't in the bar itself.
  const hubActive = pathname.startsWith("/admin") && !items.some((i) => i.href !== "/admin" && isActive(pathname, i.href))
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="flex">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? hubActive : isActive(pathname, href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground",
                  active && "font-medium text-brand"
                )}
              >
                <Icon className="size-5" />
                {label}
                {href === "/admin/verify" && pendingCount > 0 && (
                  <span className="absolute top-1 left-1/2 ml-2 rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                    {pendingCount}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
