// Gives the three demo accounts fresh passwords and writes them to demo-logins.txt
// (on this Mac only – the file is excluded from git). Run again any time to reset them.
// Usage: npx tsx scripts/set-demo-passwords.ts
import { randomInt } from "node:crypto"
import { writeFileSync } from "node:fs"
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

config({ path: ".env.local", quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const ACCOUNTS = [
  { role: "Admin", email: "demo.admin@example.com", word: "Admin" },
  { role: "Pod leader (also an intern)", email: "demo.leader@example.com", word: "Leader" },
  { role: "Intern", email: "demo.intern@example.com", word: "Intern" },
]

// Easy to type, hard to guess: e.g. Azisly-Intern-k7Rm4qTx
function password(word: string) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
  let tail = ""
  for (let i = 0; i < 8; i++) tail += chars[randomInt(chars.length)]
  return `Azisly-${word}-${tail}`
}

async function main() {
  const lines = [
    "AZISLY BD CRM – DEMO LOGINS (keep private; delete these accounts before the real batch)",
    "",
    "Live site:  https://azisly-bd-crm.vercel.app",
    "On the login page click “Log in with a password instead”, then enter the email and password.",
    "",
  ]
  for (const a of ACCOUNTS) {
    const { data: profile } = await db.from("profiles").select("id").eq("email", a.email).maybeSingle()
    if (!profile) throw new Error(`${a.email} not found – run npm run db:demo first`)
    const pw = password(a.word)
    const { error } = await db.auth.admin.updateUserById(profile.id, { password: pw })
    if (error) throw new Error(`${a.email}: ${error.message}`)
    lines.push(`${a.role}`, `  Email:    ${a.email}`, `  Password: ${pw}`, "")
  }
  writeFileSync("demo-logins.txt", lines.join("\n"))
  console.log("Passwords set for 3 demo accounts; saved to demo-logins.txt")
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
