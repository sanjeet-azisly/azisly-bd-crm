"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import type { ActionResult } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

const rupees = (label: string) => z.number({ message: `Enter ${label}.` }).min(0, `${label} can’t be negative.`).max(100_000_000)
const percent = (label: string) =>
  z.number({ message: `Enter ${label}.` }).min(0, `${label} must be 0–100%.`).max(100, `${label} must be 0–100%.`)
const count = (label: string) => z.number({ message: `Enter ${label}.` }).int().min(0).max(1000)
const date = z.iso.date({ message: "Pick a valid date." })

const schema = z
  .object({
    m1_start: date,
    m2_start: date,
    m3_start: date,
    program_end: date,
    milestone_m1: rupees("the M1 milestone"),
    milestone_m2: rupees("the M2 milestone"),
    milestone_m3: rupees("the M3 milestone"),
    stipend_min: rupees("the minimum for any stipend"),
    stipend_low_rate: percent("The first-slab percentage"),
    stipend_low_max: rupees("the first slab’s upper limit"),
    stipend_mid_fixed: rupees("the middle slab’s fixed stipend"),
    stipend_mid_max: rupees("the middle slab’s upper limit"),
    stipend_high_fixed: rupees("the top slab’s minimum stipend"),
    stipend_high_rate: percent("The top-slab percentage"),
    target_outreach: count("the outreach target"),
    target_followups: count("the follow-ups target"),
    target_demos: count("the demos target"),
    business_target: rupees("the business target"),
    stretch_target: rupees("the stretch target"),
    monthly_m1: rupees("the M1 target").nullable(),
    monthly_m2: rupees("the M2 target").nullable(),
    monthly_m3: rupees("the M3 target").nullable(),
    pool_hours: z.number().int().min(1, "Pool hours must be at least 1.").max(24 * 30),
  })
  .refine((s) => s.m1_start < s.m2_start && s.m2_start < s.m3_start && s.m3_start <= s.program_end, {
    message: "Program dates must run in order: M1 start → M2 start → M3 start → end.",
  })
  .refine((s) => s.stipend_min <= s.stipend_low_max && s.stipend_low_max < s.stipend_mid_max, {
    message: "Stipend slabs must go up in order.",
  })

export async function saveSettings(input: unknown): Promise<ActionResult> {
  await requireAdmin()
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const { monthly_m1, monthly_m2, monthly_m3, stipend_low_rate, stipend_high_rate, ...rest } = parsed.data
  const monthly =
    monthly_m1 === null && monthly_m2 === null && monthly_m3 === null
      ? null
      : { M1: monthly_m1, M2: monthly_m2, M3: monthly_m3 }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("settings")
    .update({
      ...rest,
      stipend_low_rate: stipend_low_rate / 100,
      stipend_high_rate: stipend_high_rate / 100,
      monthly_targets: monthly,
    })
    .eq("id", 1)
    .select("id")
  if (error) return { ok: false, error: error.message }
  if (!data?.length) return { ok: false, error: "Couldn’t save settings." }
  revalidatePath("/", "layout")
  return { ok: true }
}
