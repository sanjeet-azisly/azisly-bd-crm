import Link from "next/link"
import { Logo } from "@/components/logo"
import { readJoinLink } from "@/lib/join-links"
import { JoinForm } from "./join-form"

export const metadata = { title: "Join · Azisly BD CRM" }
// Links are personal: never cache this page.
export const dynamic = "force-dynamic"

const PROBLEMS = {
  invalid: "This link was already used or isn’t valid.",
  expired: "This link has expired.",
  inactive: "Your access to the Azisly BD CRM is turned off.",
}

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invite = await readJoinLink(token)

  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <div className="px-4 pt-16 pb-6 text-center">
        <Logo className="text-2xl" />
        <p className="mt-2 text-sm text-muted-foreground">For the Azisly.ai BD team</p>
      </div>
      <div className="flex flex-1 justify-center px-4 pt-4 pb-10">
        <div className="w-full max-w-sm">
          {typeof invite === "string" ? (
            <div className="text-center">
              <h1 className="text-3xl font-semibold">Link not working</h1>
              <p className="mt-3 text-muted-foreground">
                {PROBLEMS[invite]} Ask your manager or admin to send you a new link.
              </p>
              <p className="mt-6 text-sm">
                Already set a password?{" "}
                <Link href="/login" className="text-brand underline-offset-2 hover:underline">
                  Log in
                </Link>
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-center text-3xl font-semibold">
                {invite.returning ? "Set a new password" : `Welcome, ${invite.fullName.split(/\s+/)[0]}`}
              </h1>
              <p className="mt-2 mb-8 text-center text-sm text-muted-foreground">
                {invite.returning
                  ? "Choose a new password for your account."
                  : "Choose a password. You’ll use it with your email to log in from now on."}
              </p>
              <JoinForm token={token} email={invite.email} />
            </>
          )}
        </div>
      </div>
    </main>
  )
}
