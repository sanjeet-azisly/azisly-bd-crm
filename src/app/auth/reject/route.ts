import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Signs out someone who has a login session but no (active) team profile.
export async function GET(request: NextRequest) {
  const reason = request.nextUrl.searchParams.get("reason") === "deactivated" ? "deactivated" : "not_invited"
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url))
}
