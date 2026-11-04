import { BottomNav, SideNav } from "@/components/app-nav"
import { Logo } from "@/components/logo"
import { UserMenu } from "@/components/user-menu"
import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser()
  const supabase = await createClient()
  const [{ count: unread }, { count: pending }, { count: flagged }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", me.profile.id).is("read_at", null),
    me.isAdmin
      ? supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "Pending")
      : Promise.resolve({ count: 0 }),
    me.isAdmin
      ? supabase.from("duplicate_attempts").select("id", { count: "exact", head: true }).is("dismissed_at", null)
      : Promise.resolve({ count: 0 }),
  ])
  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-white px-4 py-6 md:flex">
        <Logo className="px-3 text-xl" />
        <div className="mt-8 flex-1 overflow-y-auto">
          <SideNav isAdmin={me.isAdmin} isLeader={!!me.ledPod} inPod={!!me.profile.pod_id} pendingCount={pending ?? 0} flaggedCount={flagged ?? 0} />
        </div>
        <UserMenu me={me} unread={unread ?? 0} />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-white/85 px-5 py-3 backdrop-blur-xl md:hidden">
          <Logo />
          <UserMenu me={me} unread={unread ?? 0} />
        </header>
        <main className="mx-auto w-full max-w-6xl px-5 pt-8 pb-28 md:px-12 md:pt-12 md:pb-16">{children}</main>
      </div>

      <BottomNav isAdmin={me.isAdmin} isLeader={!!me.ledPod} inPod={!!me.profile.pod_id} pendingCount={pending ?? 0} />
    </div>
  )
}
