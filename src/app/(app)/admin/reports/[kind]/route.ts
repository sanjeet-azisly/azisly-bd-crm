import { NextResponse } from "next/server"
import { getCurrentUser, scopePod } from "@/lib/auth"
import { REPORTS, buildReport, type ReportKind } from "@/lib/reports"

export const maxDuration = 60

/** Excel download. Admins get everything; managers with "export" their own pod. */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  if (!(kind in REPORTS)) return new NextResponse("Not found", { status: 404 })
  const me = await getCurrentUser()
  if (!me?.profile.active || !me.can("export")) return new NextResponse("Not allowed", { status: 403 })
  try {
    const file = await buildReport(kind as ReportKind, scopePod(me))
    const day = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
    const scope = me.isAdmin ? "all" : (me.ledPod?.name ?? "pod").toLowerCase().replace(/[^a-z0-9]+/g, "-")
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="azisly-${kind}-${scope}-${day}.xlsx"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    console.error("report failed", e)
    return new NextResponse("Couldn’t build the report. Try again.", { status: 500 })
  }
}
