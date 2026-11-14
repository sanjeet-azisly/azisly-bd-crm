export type UserRole = "admin" | "manager" | "intern"
export type CourseTier = "Entry" | "Core" | "Premium"

export type Profile = {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  pod_id: string | null
  referral_code: string | null
  active: boolean
  first_login_at: string | null
  /** ID card photo in the private id-photos bucket. */
  photo_path: string | null
  photo_updated_at: string | null
  /** Powers the admin switched on (managers only). */
  permissions: Permission[]
  /** Manager's share of their pod's verified revenue, in %. */
  commission_pct: number | null
  created_at: string
}

export type Pod = {
  id: string
  name: string
  colour: string
  leader_id: string | null
  target_override: number | null
  created_at: string
}

export type Objection = { q: string; a: string }

export type Course = {
  id: string
  name: string
  short_name: string
  slug: string
  one_line_value: string
  offer_price: number
  original_price: number | null
  typical_close: string
  tier: CourseTier
  who_for: string
  what_they_get: string[]
  proof: string
  pitch: string
  objections: Objection[]
  brochure_url: string | null
  payment_url: string | null
  installments_allowed: boolean
  active: boolean
  sort_order: number
}

export type Invite = {
  id: string
  email: string
  full_name: string
  role: UserRole
  pod_id: string | null
  phone: string | null
  make_leader: boolean
  link_sent_at: string | null
  accepted_at: string | null
  created_at: string
}

/** What the Team screen calls a role. A manager runs one pod (Azisly staff, not an intern). */
export type TeamRole = UserRole

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  admin: "Admin",
  manager: "Manager",
  intern: "Intern",
}

export const PERMISSIONS = [
  { key: "manage_team", label: "Add and manage their interns", hint: "Add people, upload a sheet, joining links, ID photos" },
  { key: "approve_payments", label: "Approve payments", hint: "Verify or reject their pod’s payments (not their own)" },
  { key: "export", label: "Download Excel reports", hint: "Their pod’s leads, payments and people" },
  { key: "flags", label: "See flagged leads", hint: "Duplicate numbers that involve their pod" },
  { key: "courses", label: "Edit course setup", hint: "Prices, pitch and payment links for every course" },
] as const

export type Permission = (typeof PERMISSIONS)[number]["key"]

/** What a new manager gets until the admin changes it. */
export const DEFAULT_MANAGER_PERMISSIONS: Permission[] = ["manage_team", "export", "flags"]
