import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { requireUser } from "@/lib/auth"
import { formatDateTime } from "@/lib/leads"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata = { title: "Notifications · Azisly BD CRM" }

export default async function NotificationsPage() {
  const me = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("notifications")
    .select("id, text, link, read_at, created_at")
    .eq("user_id", me.profile.id)
    .order("created_at", { ascending: false })
    .limit(50)
  // Opening this page marks everything as read.
  if ((data ?? []).some((n) => !n.read_at)) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", me.profile.id).is("read_at", null)
  }

  return (
    <>
      <PageHeader title="Notifications" />
      <ul className="divide-y rounded-2xl bg-surface">
        {(data ?? []).map((n) => (
          <li key={n.id} className={cn("p-3 text-sm", !n.read_at && "bg-brand-soft")}>
            {n.link ? (
              <Link href={n.link} className="font-medium hover:underline">
                {n.text}
              </Link>
            ) : (
              <p className="font-medium">{n.text}</p>
            )}
            <p className="text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
          </li>
        ))}
        {(data ?? []).length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</li>}
      </ul>
    </>
  )
}
