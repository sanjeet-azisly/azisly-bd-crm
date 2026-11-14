import Link from "next/link"
import { Bell, IdCard, LogOut } from "lucide-react"
import type { CurrentUser } from "@/lib/auth"
import { cn } from "@/lib/utils"

export function roleLabel(me: CurrentUser) {
  if (me.isAdmin) return "Admin"
  if (me.isManager) return me.ledPod ? `Manager · ${me.ledPod.name}` : "Manager"
  return "Intern"
}

export function UserMenu({ me, light = false, unread = 0 }: { me: CurrentUser; light?: boolean; unread?: number }) {
  return (
    <div className={cn("flex items-center gap-3", light ? "text-white" : "text-foreground")}>
      <Link href="/profile" title="My profile" className="hidden min-w-0 text-right leading-tight min-[420px]:block md:block">
        <p className="truncate text-sm font-medium">{me.profile.full_name}</p>
        <p className={cn("text-xs", light ? "text-white/60" : "text-muted-foreground")}>{roleLabel(me)}</p>
      </Link>
      <Link
        href="/profile"
        aria-label={me.profile.photo_path ? "ID card photo" : "Upload your ID card photo"}
        title="My profile"
        className={cn("relative rounded-lg p-2", light ? "hover:bg-white/10" : "hover:bg-muted")}
      >
        <IdCard className="size-4" />
        {!me.profile.photo_path && me.profile.role === "intern" && (
          <span className="absolute top-1 right-1 size-2 rounded-full bg-[#f59e0b]" aria-hidden />
        )}
      </Link>
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
