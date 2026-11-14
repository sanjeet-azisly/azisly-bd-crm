// Menu items and who sees them. Shared by the side menu, the phone bar and the Admin / Manage hub.
import type React from "react"
import {
  BadgeCheck,
  BookOpen,
  Calculator,
  Contact,
  Crown,
  FileSpreadsheet,
  Flag,
  GraduationCap,
  Home,
  IdCard,
  LayoutDashboard,
  SlidersHorizontal,
  Trophy,
  Users,
  UsersRound,
  Waves,
} from "lucide-react"
import type { Permission } from "@/lib/types"

/** Who is looking: decides which menu items show. */
export type NavViewer = {
  isAdmin: boolean
  isManager: boolean
  /** Runs a pod (managers). */
  leadsPod: boolean
  inPod: boolean
  perms: Permission[]
}

export type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Part of the Admin / Manage section. */
  manage?: boolean
  /** One line for the hub page. */
  hint?: string
  show: (v: NavViewer) => boolean
}

const has = (p: Permission) => (v: NavViewer) => v.isAdmin || v.perms.includes(p)
const always = () => true

export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: Home, show: always },
  { href: "/leads", label: "Leads", icon: Contact, show: always },
  { href: "/courses", label: "Courses", icon: GraduationCap, show: always },
  { href: "/leaderboard", label: "Ranks", icon: Trophy, show: always },
  { href: "/pod", label: "My pod", icon: Crown, show: (v) => v.leadsPod && !v.isAdmin },
  { href: "/pool", label: "Pool", icon: Waves, show: (v) => v.inPod || v.isAdmin },
  { href: "/earnings", label: "Earnings", icon: Calculator, show: always },
  { href: "/admin/dashboard", hint: "Revenue vs targets, funnel, CSV", label: "Dashboard", icon: LayoutDashboard, manage: true, show: (v) => v.isAdmin },
  { href: "/admin/verify", hint: "Pending payments, oldest first", label: "Verify", icon: BadgeCheck, manage: true, show: has("approve_payments") },
  { href: "/admin/flags", hint: "Attempts to add numbers already in the CRM", label: "Flagged leads", icon: Flag, manage: true, show: has("flags") },
  { href: "/pod", label: "Pod view", icon: Crown, manage: true, show: (v) => v.isAdmin },
  { href: "/admin/team", hint: "Add people, roles, powers, joining links", label: "Team", icon: Users, manage: true, show: has("manage_team") },
  { href: "/admin/photos", hint: "Passport photos for ID cards", label: "ID photos", icon: IdCard, manage: true, show: has("manage_team") },
  { href: "/admin/reports", hint: "Leads, payments and people as Excel", label: "Excel reports", icon: FileSpreadsheet, manage: true, show: has("export") },
  { href: "/admin/pods", hint: "Create pods, choose managers", label: "Pods", icon: UsersRound, manage: true, show: (v) => v.isAdmin },
  { href: "/admin/courses", hint: "Prices, pitch, payment links", label: "Course setup", icon: BookOpen, manage: true, show: has("courses") },
  { href: "/admin/settings", hint: "Dates, milestones, slabs, targets, pool", label: "Settings", icon: SlidersHorizontal, manage: true, show: (v) => v.isAdmin },
]


/** Plain data about the signed-in person, safe to pass to the client menus. */
export function navViewer(me: { isAdmin: boolean; isManager: boolean; ledPod: unknown; profile: { pod_id: string | null; permissions: Permission[] } }): NavViewer {
  return {
    isAdmin: me.isAdmin,
    isManager: me.isManager,
    leadsPod: !!me.ledPod,
    inPod: !!me.profile.pod_id,
    perms: me.isAdmin ? [] : (me.profile.permissions ?? []),
  }
}
