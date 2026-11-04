export type UserRole = "admin" | "intern"
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

/** What the Team screen calls a role. "leader" is an intern who leads their pod. */
export type TeamRole = "admin" | "leader" | "intern"

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  admin: "Admin",
  leader: "Pod leader",
  intern: "Intern",
}
