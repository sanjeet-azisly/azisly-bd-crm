import "server-only"
import { createClient } from "@supabase/supabase-js"

// Service-role client. Bypasses row level security, so only use it for
// Supabase Auth admin calls after the caller has been checked as an admin.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
