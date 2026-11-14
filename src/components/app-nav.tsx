"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, Settings2 } from "lucide-react"
import { NAV_ITEMS, type NavItem, type NavViewer } from "@/lib/nav"
import { cn } from "@/lib/utils"

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

type Counts = { pendingCount: number; flaggedCount?: number }

export function SideNav({ viewer, pendingCount, flaggedCount = 0 }: { viewer: NavViewer } & Counts) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((i) => i.show(viewer))
  return (
    <nav className="space-y-0.5" aria-label="Main">
      {items.map(({ href, label, icon: Icon, manage }, idx) => (
        <div key={`${href}-${label}`}>
          {manage && !items[idx - 1]?.manage && (
            <p className="mt-8 mb-2 flex items-center gap-1.5 px-4 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <Settings2 className="size-3" /> {viewer.isAdmin ? "Admin" : "Manage"}
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

/** Phone bar: at most 5 items. Everything else lives on the Admin / Manage hub page. */
function bottomItems(v: NavViewer): NavItem[] {
  const byHref = (h: string) => NAV_ITEMS.find((i) => i.href === h)!
  const hasHub = NAV_ITEMS.some((i) => i.manage && i.show(v))
  const hub: NavItem = { href: "/admin", label: v.isAdmin ? "Admin" : "Manage", icon: LayoutGrid, show: () => true }
  if (v.isAdmin) return [byHref("/today"), byHref("/leads"), byHref("/leaderboard"), byHref("/admin/verify"), hub]
  const list = [byHref("/today"), byHref("/leads")]
  list.push(v.leadsPod ? byHref("/leaderboard") : byHref("/courses"))
  list.push(v.leadsPod ? byHref("/pod") : byHref("/leaderboard"))
  list.push(hasHub ? hub : byHref("/earnings"))
  return list
}

export function BottomNav({ viewer, pendingCount }: { viewer: NavViewer } & Counts) {
  const pathname = usePathname()
  const items = bottomItems(viewer)
  // The hub is "active" on any admin page that isn't in the bar itself.
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
