// Applies every SQL file in supabase/migrations that hasn't run yet.
// Usage: npm run db:migrate
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { config } from "dotenv"
import { Client } from "pg"

config({ path: ".env.local" })

async function main() {
  const url = process.env.DATABASE_URL
  if (!url || url.includes("YOUR-PASSWORD")) throw new Error("DATABASE_URL is missing in .env.local")
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()
  // Kept outside the "public" schema so it is never exposed through the API.
  await client.query(`create schema if not exists app_meta;
    create table if not exists app_meta.migrations (name text primary key, applied_at timestamptz not null default now());`)
  const { rows } = await client.query<{ name: string }>("select name from app_meta.migrations")
  const done = new Set(rows.map((r) => r.name))
  const dir = join(process.cwd(), "supabase", "migrations")
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
  for (const file of files) {
    if (done.has(file)) continue
    process.stdout.write(`Applying ${file}… `)
    await client.query("begin")
    try {
      await client.query(readFileSync(join(dir, file), "utf8"))
      await client.query("insert into app_meta.migrations (name) values ($1)", [file])
      await client.query("commit")
      console.log("done")
    } catch (e) {
      await client.query("rollback")
      console.log("FAILED")
      throw e
    }
  }
  console.log("Database is up to date.")
  await client.end()
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
