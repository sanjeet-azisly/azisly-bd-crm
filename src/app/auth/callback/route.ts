import { NextResponse, type NextRequest } from "next/server"
import { finishLogin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// Google sends people back here after they pick their account.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error")

  if (oauthError) {
    // With sign-ups switched off, Supabase rejects Google accounts that were never invited.
    const notInvited = /signup|not allowed|database error saving new user/i.test(oauthError)
    return NextResponse.redirect(`${origin}/login?error=${notInvited ? "not_invited" : "google"}`)
  }
  if (!code) return NextResponse.redirect(`${origin}/login?error=google`)

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(`${origin}/login?error=google`)

  const result = await finishLogin()
  return NextResponse.redirect(result === "ok" ? `${origin}/today` : `${origin}/login?error=${result}`)
}
