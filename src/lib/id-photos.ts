import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

export const PHOTO_BUCKET = "id-photos"

/**
 * Short-lived links to ID card photos. Only call this with paths the signed-in
 * person may see (their own, or anyone's for an admin).
 * With `downloadNames`, the link downloads the file under that name.
 */
export async function photoLinks(paths: (string | null)[], expiresIn = 60 * 30): Promise<Record<string, string>> {
  const clean = [...new Set(paths.filter((p): p is string => !!p))]
  if (clean.length === 0) return {}
  const { data } = await createAdminClient().storage.from(PHOTO_BUCKET).createSignedUrls(clean, expiresIn)
  const out: Record<string, string> = {}
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl
  return out
}

/** "Riya Sharma" → "Riya-Sharma.jpg", safe for a file name. */
export function photoFileName(name: string, taken = new Set<string>()) {
  const base = name.replace(/\(.*?\)/g, "").trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "photo"
  let file = `${base}.jpg`
  for (let n = 2; taken.has(file.toLowerCase()); n++) file = `${base}-${n}.jpg`
  taken.add(file.toLowerCase())
  return file
}
