"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, FileSpreadsheet, Mail, Pencil, Plus, Search, Send } from "lucide-react"
import { toast } from "sonner"
import { Chip } from "@/components/chip"
import { ConfirmButton } from "@/components/confirm-button"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { PhoneInput } from "@/components/phone-input"
import { TEAM_ROLE_LABEL, type Pod, type Profile, type TeamRole } from "@/lib/types"
import { PHONE_ERROR, normalizePhone } from "@/lib/format"
import { deleteMember, inviteMember, setMemberActive, updateMember } from "./actions"
import { BulkUploadDialog } from "./bulk-upload"
import { describeOutcome, sendLinksTo } from "./send-links"

type Props = { meId: string; profiles: Profile[]; pods: Pod[]; linkSentAt: Record<string, string> }

function teamRole(p: Profile, pods: Pod[]): TeamRole {
  if (p.role === "admin") return "admin"
  return pods.some((pod) => pod.leader_id === p.id) ? "leader" : "intern"
}

export function TeamClient({ meId, profiles, pods, linkSentAt }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [shareText, setShareText] = useState<{ name: string; email: string; text: string } | null>(null)
  const podById = useMemo(() => new Map(pods.map((p) => [p.id, p])), [pods])
  const existingEmails = useMemo(() => new Set(profiles.map((p) => p.email.toLowerCase())), [profiles])
  const waiting = profiles.filter((p) => p.active && !p.first_login_at && p.id !== meId)

  async function sendWaitingLinks() {
    const emails = waiting.map((p) => p.email)
    setSending(`Sending 0/${emails.length}…`)
    const outcome = await sendLinksTo(emails, (done, total) => setSending(`Sending ${done}/${total}…`))
    setSending(null)
    const text = describeOutcome(outcome, emails.length)
    if (outcome.stoppedByLimit || outcome.failed.length) toast.warning(text, { duration: 10000 })
    else toast.success(text)
    router.refresh()
  }

  const filtered = profiles.filter((p) => {
    const q = query.trim().toLowerCase()
    return !q || p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 bg-white pl-9"
          />
        </div>
        <Button variant="outline" className="h-10" onClick={() => setUploadOpen(true)}>
          <FileSpreadsheet /> Upload sheet
        </Button>
        <Button className="h-10" onClick={() => setInviteOpen(true)}>
          <Plus /> Add person
        </Button>
      </div>

      {waiting.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#fdf1d6] px-5 py-4 text-sm text-[#8a5300]">
          <span>
            {waiting.length} {waiting.length === 1 ? "person hasn’t" : "people haven’t"} logged in yet.
          </span>
          <ConfirmButton
            label={
              <>
                <Send /> {sending ?? "Send login links"}
              </>
            }
            variant="default"
            title={`Email login links to ${waiting.length} ${waiting.length === 1 ? "person" : "people"}?`}
            description="Everyone who hasn’t logged in yet gets a fresh one-tap login link. Links expire after an hour; they can always ask for a new one on the login page."
            confirmLabel="Send links"
            onConfirm={sendWaitingLinks}
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {profiles.filter((p) => p.active).length} active · {profiles.filter((p) => !p.active).length} deactivated
      </p>

      <ul className="divide-y rounded-2xl bg-surface">
        {filtered.map((p) => {
          const pod = p.pod_id ? podById.get(p.pod_id) : null
          const role = teamRole(p, pods)
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-5">
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate font-medium">
                  {p.full_name} {p.id === meId && <span className="text-xs text-muted-foreground">(you)</span>}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {p.email}
                  {p.phone && <> · +91 {p.phone}</>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone={role === "admin" ? "violet" : role === "leader" ? "brand" : "grey"}>{TEAM_ROLE_LABEL[role]}</Chip>
                {pod && (
                  <Chip>
                    <span className="size-2 rounded-full" style={{ background: pod.colour }} />
                    {pod.name}
                  </Chip>
                )}
                {p.referral_code && <Chip tone="grey">Code: {p.referral_code}</Chip>}
                {!p.active ? (
                  <Chip tone="red">Deactivated</Chip>
                ) : p.first_login_at ? (
                  <Chip tone="green">Active</Chip>
                ) : linkSentAt[p.email.toLowerCase()] ? (
                  <Chip tone="amber">
                    Invited · link sent{" "}
                    {new Date(linkSentAt[p.email.toLowerCase()]).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </Chip>
                ) : (
                  <Chip tone="amber">Invited · no link sent</Chip>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                <Pencil /> Edit
              </Button>
            </li>
          )
        })}
        {filtered.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No one matches.</li>}
      </ul>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        pods={pods}
        onInvited={async (name, email, text, sendNow) => {
          setInviteOpen(false)
          router.refresh()
          if (!sendNow) return void toast.success(`${name} added`)
          const outcome = await sendLinksTo([email])
          if (outcome.sent.length) toast.success(`${name} added and emailed a login link`)
          else setShareText({ name, email, text })
          router.refresh()
        }}
      />

      <BulkUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} existingEmails={existingEmails} pods={pods} />

      {editing && (
        <EditDialog
          key={editing.id}
          profile={editing}
          isMe={editing.id === meId}
          pods={pods}
          initialRole={teamRole(editing, pods)}
          onClose={() => setEditing(null)}
        />
      )}

      <Dialog open={!!shareText} onOpenChange={(o) => !o && setShareText(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send the invite yourself</DialogTitle>
            <DialogDescription>
              {shareText?.name} is on the team, but the login email couldn’t be sent right now (usually the hourly email
              limit). Copy this message and send it on WhatsApp to {shareText?.email} – they’ll get a link from the login page.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg bg-muted p-3 text-sm">{shareText?.text}</p>
          <DialogFooter>
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(shareText?.text ?? "")
                toast.success("Invite message copied")
                setShareText(null)
              }}
            >
              <Copy /> Copy message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RoleAndPodFields({
  role,
  setRole,
  podId,
  setPodId,
  pods,
  roleDisabled,
}: {
  role: TeamRole
  setRole: (r: TeamRole) => void
  podId: string
  setPodId: (id: string) => void
  pods: Pod[]
  roleDisabled?: boolean
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="role">Role</Label>
        <NativeSelect id="role" value={role} disabled={roleDisabled} onChange={(e) => setRole(e.target.value as TeamRole)}>
          <option value="intern">Intern</option>
          <option value="leader">Pod leader</option>
          <option value="admin">Admin</option>
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pod">Pod</Label>
        <NativeSelect id="pod" value={podId} onChange={(e) => setPodId(e.target.value)}>
          <option value="">No pod</option>
          {pods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      {role === "leader" && (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Each pod has one leader. Marking this person replaces the pod’s current leader.
        </p>
      )}
    </div>
  )
}

function InviteDialog({
  open,
  onOpenChange,
  pods,
  onInvited,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  pods: Pod[]
  onInvited: (name: string, email: string, text: string, sendNow: boolean) => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [sendNow, setSendNow] = useState(true)
  const [role, setRole] = useState<TeamRole>("intern")
  const [podId, setPodId] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (normalizePhone(phone) === "invalid") return setError(PHONE_ERROR)
    setBusy(true)
    const res = await inviteMember({ full_name: name, email, phone, role, pod_id: podId || null })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    if (res.message) toast.warning(res.message)
    onInvited(name.trim(), email.trim().toLowerCase(), res.data!.inviteText, sendNow)
    setName("")
    setEmail("")
    setPhone("")
    setRole("intern")
    setPodId("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-6" noValidate>
          <DialogHeader>
            <DialogTitle>Add a person</DialogTitle>
            <DialogDescription>Only invited emails can log in.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">Name</Label>
            <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">Email</Label>
            <Input id="inv-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-phone">Phone</Label>
            <PhoneInput id="inv-phone" value={phone} onChange={setPhone} />
          </div>
          <RoleAndPodFields role={role} setRole={setRole} podId={podId} setPodId={setPodId} pods={pods} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={sendNow} onCheckedChange={(v) => setSendNow(v === true)} /> Email them a login link now
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add to team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditDialog({
  profile,
  isMe,
  pods,
  initialRole,
  onClose,
}: {
  profile: Profile
  isMe: boolean
  pods: Pod[]
  initialRole: TeamRole
  onClose: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(profile.full_name)
  const [phone, setPhone] = useState(profile.phone ?? "")
  const [role, setRole] = useState<TeamRole>(initialRole)
  const [podId, setPodId] = useState(profile.pod_id ?? "")
  const [code, setCode] = useState(profile.referral_code ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (normalizePhone(phone) === "invalid") return setError(PHONE_ERROR)
    setBusy(true)
    const res = await updateMember({
      id: profile.id,
      full_name: name,
      phone,
      role,
      pod_id: podId || null,
      referral_code: code,
    })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    toast.success("Saved")
    router.refresh()
    onClose()
  }

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    const res = await action()
    if (!res.ok) {
      toast.error(res.error ?? "Something went wrong")
      return
    }
    toast.success(success)
    router.refresh()
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={save} className="space-y-6" noValidate>
          <DialogHeader>
            <DialogTitle>Edit {profile.full_name}</DialogTitle>
            <DialogDescription>{profile.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ed-name">Name</Label>
            <Input id="ed-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-phone">Phone</Label>
            <PhoneInput id="ed-phone" value={phone} onChange={setPhone} />
          </div>
          <RoleAndPodFields
            role={role}
            setRole={setRole}
            podId={podId}
            setPodId={setPodId}
            pods={pods}
            roleDisabled={isMe}
          />
          <div className="space-y-1.5">
            <Label htmlFor="ed-code">Referral code</Label>
            <Input
              id="ed-code"
              value={code}
              placeholder="Created automatically on first login"
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">Goes on their course page links. Must be unique.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>

        {!isMe && (
          <div className="mt-2 space-y-2 border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Access</p>
            <div className="flex flex-wrap gap-2">
              {profile.active && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const outcome = await sendLinksTo([profile.email])
                    if (outcome.sent.length) toast.success(`Login link sent to ${profile.email}`)
                    else toast.error(describeOutcome(outcome, 1))
                    router.refresh()
                  }}
                >
                  <Mail /> Send login link
                </Button>
              )}
              {profile.active ? (
                <ConfirmButton
                  label="Deactivate"
                  title={`Deactivate ${profile.full_name}?`}
                  description="They won’t be able to log in. You can turn them back on later."
                  confirmLabel="Deactivate"
                  destructive
                  onConfirm={() => run(() => setMemberActive(profile.id, false), "Deactivated")}
                />
              ) : (
                <Button variant="outline" size="sm" onClick={() => run(() => setMemberActive(profile.id, true), "Reactivated")}>
                  Reactivate
                </Button>
              )}
              <ConfirmButton
                label="Delete"
                variant="destructive"
                title={`Delete ${profile.full_name} for good?`}
                description="Use this for test or sample accounts. People with leads or payments can only be deactivated."
                confirmLabel="Delete"
                destructive
                onConfirm={() => run(() => deleteMember(profile.id), "Deleted")}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
