import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Short-lived links to payment screenshots. Only call this with paths from payments
 * the signed-in person was already allowed to read (row level security).
 */
export async function screenshotLinks(paths: (string | null)[]): Promise<Record<string, string>> {
  const clean = [...new Set(paths.filter((p): p is string => !!p))]
  if (clean.length === 0) return {}
  const { data } = await createAdminClient().storage.from("payment-screenshots").createSignedUrls(clean, 60 * 30)
  const out: Record<string, string> = {}
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl
  return out
}
