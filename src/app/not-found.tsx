import Link from "next/link"
import { Logo } from "@/components/logo"

export default function NotFound() {
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <Logo className="text-base" />
      <h1 className="mt-6 text-3xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">This page doesn’t exist or isn’t available any more.</p>
      <Link href="/" className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background">
        Go to the CRM
      </Link>
    </main>
  )
}
