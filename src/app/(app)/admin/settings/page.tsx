import { requireAdmin } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { createClient } from "@/lib/supabase/server"
import { SettingsForm, type SettingsValues } from "./settings-form"

export const metadata = { title: "Settings · Azisly BD CRM" }

export default async function SettingsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data: s } = await supabase.from("settings").select("*").eq("id", 1).single()
  const monthly = (s?.monthly_targets ?? {}) as Partial<Record<"M1" | "M2" | "M3", number | null>>
  const n = (v: unknown) => (v === null || v === undefined ? "" : String(Number(v)))
  const values: SettingsValues = {
    m1_start: s.m1_start,
    m2_start: s.m2_start,
    m3_start: s.m3_start,
    program_end: s.program_end,
    milestone_m1: n(s.milestone_m1),
    milestone_m2: n(s.milestone_m2),
    milestone_m3: n(s.milestone_m3),
    stipend_min: n(s.stipend_min),
    stipend_low_rate: n(Math.round(Number(s.stipend_low_rate) * 10000) / 100),
    stipend_low_max: n(s.stipend_low_max),
    stipend_mid_fixed: n(s.stipend_mid_fixed),
    stipend_mid_max: n(s.stipend_mid_max),
    stipend_high_fixed: n(s.stipend_high_fixed),
    stipend_high_rate: n(Math.round(Number(s.stipend_high_rate) * 10000) / 100),
    target_outreach: n(s.target_outreach),
    target_followups: n(s.target_followups),
    target_demos: n(s.target_demos),
    business_target: n(s.business_target),
    stretch_target: n(s.stretch_target),
    monthly_m1: n(monthly.M1),
    monthly_m2: n(monthly.M2),
    monthly_m3: n(monthly.M3),
    pool_hours: n(s.pool_hours),
  }
  return (
    <>
      <PageHeader title="Settings" description="Program rules. Changes apply everywhere straight away." />
      <SettingsForm initial={values} />
    </>
  )
}
