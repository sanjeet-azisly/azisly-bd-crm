import { redirect } from "next/navigation"
import { Logo } from "@/components/logo"
import { DEACTIVATED_MESSAGE, NOT_INVITED_MESSAGE, getCurrentUser } from "@/lib/auth"
import { devLoginEnabled } from "@/lib/dev-login"
import { createAdminClient } from "@/lib/supabase/admin"
import { DevLogin } from "./dev-login"
import { LoginForm } from "./login-form"

export const metadata = { title: "Log in · Azisly BD CRM" }

const ERRORS: Record<string, string> = {
  not_invited: NOT_INVITED_MESSAGE,
  deactivated: DEACTIVATED_MESSAGE,
  google: "Google login didn’t finish. Try again, or use the email link instead.",
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const me = await getCurrentUser()
  if (me?.profile.active && !error) redirect("/today")

  let devPeople: { email: string; label: string }[] = []
  if (devLoginEnabled()) {
    const { data } = await createAdminClient()
      .from("profiles")
      .select("email, full_name, role")
      .eq("active", true)
      .order("role")
      .order("full_name")
    devPeople = (data ?? []).map((p) => ({ email: p.email, label: `${p.full_name} (${p.role === "admin" ? "Admin" : p.role === "manager" ? "Manager" : "Intern"})` }))
  }

  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <div className="px-4 pt-16 pb-6 text-center">
        <Logo className="text-2xl" />
        <p className="mt-2 text-sm text-muted-foreground">For the Azisly.ai BD internship team</p>
      </div>
      <div className="flex flex-1 justify-center px-4 pt-4 pb-10">
        <div className="w-full max-w-sm">
          <h1 className="text-center text-3xl font-semibold">Log in</h1>
          <p className="mt-2 mb-8 text-center text-sm text-muted-foreground">Use the email and password you set from your joining link.</p>
          {error && ERRORS[error] && (
            <p role="alert" className="mb-5 rounded-xl bg-[#fdecea] px-4 py-3 text-sm text-[#b42318]">
              {ERRORS[error]}
            </p>
          )}
          <LoginForm />
          {devPeople.length > 0 && <DevLogin people={devPeople} />}
        </div>
      </div>
    </main>
  )
}
