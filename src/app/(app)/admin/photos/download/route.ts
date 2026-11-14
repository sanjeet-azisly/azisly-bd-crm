import { NextResponse, type NextRequest } from "next/server"
import { zipSync } from "fflate"
import { getCurrentUser, scopePod } from "@/lib/auth"
import { PHOTO_BUCKET, photoFileName } from "@/lib/id-photos"
import { createAdminClient } from "@/lib/supabase/admin"

export const maxDuration = 60

/**
 * Admins only. `?id=<person>` downloads one photo named after the person;
 * without it, every uploaded photo comes as one zip file.
 */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me?.profile.active || !me.can("manage_team")) return new NextResponse("Not allowed", { status: 403 })
  const pod = scopePod(me)

  const db = createAdminClient()
  const id = req.nextUrl.searchParams.get("id")
  let query = db.from("profiles").select("id, full_name, photo_path").eq("active", true).eq("role", "intern").not("photo_path", "is", null).order("full_name")
  if (id) query = query.eq("id", id)
  if (pod) query = query.eq("pod_id", pod)
  const { data: people } = await query
  if (!people?.length) return new NextResponse("No photos to download.", { status: 404 })

  const taken = new Set<string>()
  const files: Record<string, Uint8Array> = {}
  await Promise.all(
    people.map(async (p) => {
      const { data } = await db.storage.from(PHOTO_BUCKET).download(p.photo_path!)
      if (data) files[photoFileName(p.full_name, taken)] = new Uint8Array(await data.arrayBuffer())
    })
  )
  const names = Object.keys(files)
  if (names.length === 0) return new NextResponse("Couldn’t read the photos.", { status: 500 })

  if (id) {
    return new NextResponse(Buffer.from(files[names[0]]), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="${names[0]}"`,
        "Cache-Control": "no-store",
      },
    })
  }
  // JPEGs are already compressed, so store them as they are.
  const zip = zipSync(Object.fromEntries(names.map((n) => [n, [files[n], { level: 0 }]])))
  const day = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="azisly-id-photos-${day}.zip"`,
      "Cache-Control": "no-store",
    },
  })
}
