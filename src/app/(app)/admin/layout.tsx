import { requireUser } from "@/lib/auth"

// Each page checks its own power (admins, or managers the admin allowed).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUser()
  return children
}
