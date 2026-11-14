import { Check, X } from "lucide-react"
import { Chip } from "@/components/chip"
import { PageHeader } from "@/components/page-header"
import { requireUser } from "@/lib/auth"
import { photoLinks } from "@/lib/id-photos"
import { PasswordForm } from "./password-form"
import { PhotoUploader } from "./photo-uploader"

export const metadata = { title: "My profile · Azisly BD CRM" }

const DO = [
  "Plain white or light background",
  "Face and top of shoulders, looking straight at the camera",
  "Formal or smart clothes",
  "Good, even light on your face – stand facing a window",
  "A recent photo, taken in portrait (upright)",
]
const DONT = [
  "Selfies at arm’s length, group photos or cropped party pictures",
  "Sunglasses, caps or filters",
  "Busy backgrounds, shadows or blurry photos",
]

export default async function ProfilePage() {
  const me = await requireUser()
  const path = me.profile.photo_path
  const url = path ? (await photoLinks([path]))[path] ?? null : null

  return (
    <>
      <PageHeader
        title="My profile"
        description="Your ID card photo and your password. The photo goes on your Azisly ID card, so please follow the tips below."
      />

      <section className="rounded-2xl bg-surface p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{me.profile.full_name}</h2>
          {path ? (
            <Chip tone="green">
              Uploaded
              {me.profile.photo_updated_at &&
                ` ${new Date(me.profile.photo_updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}`}
            </Chip>
          ) : (
            <Chip tone="amber">Photo needed</Chip>
          )}
        </div>
        <PhotoUploader currentUrl={url} />
      </section>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl bg-surface p-6">
          <h3 className="mb-4 font-semibold">Do</h3>
          <ul className="space-y-3">
            {DO.map((t) => (
              <li key={t} className="flex gap-3 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-[#16a34a]" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-surface p-6">
          <h3 className="mb-4 font-semibold">Avoid</h3>
          <ul className="space-y-3">
            {DONT.map((t) => (
              <li key={t} className="flex gap-3 text-sm">
                <X className="mt-0.5 size-4 shrink-0 text-[#dc2626]" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section id="password" className="mt-8 rounded-2xl bg-surface p-6 sm:p-8">
        <h2 className="mb-1 text-lg font-semibold">Password</h2>
        <p className="mb-6 text-sm text-muted-foreground">You log in with {me.profile.email} and this password.</p>
        <PasswordForm />
      </section>
    </>
  )
}
