import "server-only"

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")
}

/** The invite wording from the spec, for the admin to copy and send by hand when needed. */
export function inviteBody(name: string) {
  return `Hi ${name}, you’ve been added to the Azisly BD Internship CRM. Log in with this email at ${appUrl()} to see your leads, courses and leaderboard.`
}
