import Link from "next/link"
import { Bell, LogOut } from "lucide-react"
import type { CurrentUser } from "@/lib/auth"
import { cn } from "@/lib/utils"

export function roleLabel(me: CurrentUser) {
  if (me.isAdmin) return "Admin"
  if (me.ledPod) return "Pod leader"
  return "Intern"
}

export function UserMenu({ me, light = false, unread = 0 }: { me: CurrentUser; light?: boolean; unread?: number }) {
  return (
    <div className={cn("flex items-center gap-3", light ? "text-white" : "text-foreground")}>
      <div className="hidden min-w-0 text-right leading-tight min-[420px]:block md:block">
        <p className="truncate text-sm font-medium">{me.profile.full_name}</p>
        <p className={cn("text-xs", light ? "text-white/60" : "text-muted-foreground")}>{roleLabel(me)}</p>
      </div>
      <Link
        href="/notifications"
        aria-label={unread ? `${unread} new notifications` : "Notifications"}
        title="Notifications"
        className={cn("relative rounded-lg p-2", light ? "hover:bg-white/10" : "hover:bg-muted")}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 rounded-full bg-[#ff3b30] px-1 text-center text-[10px] leading-4 font-semibold text-white">
            {unread}
          </span>
        )}
      </Link>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          aria-label="Log out"
          title="Log out"
          className={cn("rounded-lg p-2", light ? "hover:bg-white/10" : "hover:bg-muted")}
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  )
}
