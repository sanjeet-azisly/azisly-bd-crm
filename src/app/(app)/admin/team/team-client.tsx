"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { FileSpreadsheet, Link2, Mail, Pencil, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { Chip } from "@/components/chip"
import { ConfirmButton } from "@/components/confirm-button"
import { PhoneInput } from "@/components/phone-input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { PHONE_ERROR, normalizePhone } from "@/lib/format"
import { PERMISSIONS, TEAM_ROLE_LABEL, type Permission, type Pod, type Profile, type TeamRole } from "@/lib/types"
import { deleteMember, getJoinLink, inviteMember, setMemberActive, updateMember, type JoinLinkResult } from "./actions"
import { BulkUploadDialog } from "./bulk-upload"
import { describeOutcome, sendLinksTo } from "./send-links"
import { ShareLinkDialog } from "./share-link"

type Props = { meId: string; isAdmin: boolean; profiles: Profile[]; pods: Pod[]; linkSentAt: Record<string, string> }

const ROLE_TONE = { admin: "violet", manager: "brand", intern: "grey" } as const

export function TeamClient({ meId, isAdmin, profiles, pods, linkSentAt }: Props) {
  const [query, setQuery] = useState("")
  const [onlyWaiting, setOnlyWaiting] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [share, setShare] = useState<JoinLinkResult | null>(null)
  const [linking, setLinking] = useState<string | null>(null)
  const podById = useMemo(() => new Map(pods.map((p) => [p.id, p])), [pods])
  const existingEmails = useMemo(() => new Set(profiles.map((p) => p.email.toLowerCase())), [profiles])
  const waiting = profiles.filter((p) => p.active && !p.first_login_at && p.id !== meId)
  const managedPod = !isAdmin ? pods[0] : null

  async function openLink(p: Profile) {
    setLinking(p.id)
    const res = await getJoinLink(p.id)
    setLinking(null)
    if (!res.ok) return void toast.error(res.error)
    setShare(res.data!)
  }

  const filtered = profiles.filter((p) => {
    const q = query.trim().toLowerCase()
    if (onlyWaiting && !(p.active && !p.first_login_at && p.id !== meId)) return false
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
          <Plus /> {isAdmin ? "Add person" : "Add intern"}
        </Button>
      </div>

      {waiting.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#fdf1d6] px-5 py-4 text-sm text-[#8a5300]">
          <span>
            {waiting.length} {waiting.length === 1 ? "person hasn’t" : "people haven’t"} joined yet. Send each their joining
            link on WhatsApp.
          </span>
          <Button variant="outline" size="sm" className="bg-white" onClick={() => setOnlyWaiting((v) => !v)}>
            {onlyWaiting ? "Show everyone" : "Show them"}
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {profiles.filter((p) => p.active).length} active · {profiles.filter((p) => !p.active).length} deactivated
      </p>

      <ul className="divide-y rounded-2xl bg-surface">
        {filtered.map((p) => {
          const pod = p.pod_id ? podById.get(p.pod_id) : null
          const runs = pods.find((x) => x.leader_id === p.id)
          const sent = linkSentAt[p.email.toLowerCase()]
          const editable = isAdmin || (p.role === "intern" && p.id !== meId)
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
                <Chip tone={ROLE_TONE[p.role]}>
                  {TEAM_ROLE_LABEL[p.role]}
                  {runs && ` · runs ${runs.name}`}
                </Chip>
                {pod && !runs && isAdmin && (
                  <Chip>
                    <span className="size-2 rounded-full" style={{ background: pod.colour }} />
                    {pod.name}
                  </Chip>
                )}
                {!p.active ? (
                  <Chip tone="red">Deactivated</Chip>
                ) : p.first_login_at ? (
                  <Chip tone="green">Joined</Chip>
                ) : (
                  <Chip tone="amber">
                    {sent
                      ? `Link sent ${new Date(sent).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                      : "Not joined yet"}
                  </Chip>
                )}
              </div>
              {editable && (
                <div className="flex gap-1.5">
                  {p.active && p.id !== meId && (
                    <Button variant="outline" size="sm" disabled={linking === p.id} onClick={() => openLink(p)}>
                      <Link2 /> {p.first_login_at ? "New password link" : "Joining link"}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                    <Pencil /> Edit
                  </Button>
                </div>
              )}
            </li>
          )
        })}
        {filtered.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">
            {profiles.length <= 1 ? "No one here yet. Add your first intern." : "No one matches."}
          </li>
        )}
      </ul>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        pods={pods}
        isAdmin={isAdmin}
        podName={managedPod?.name}
        onInvited={(result) => {
          setInviteOpen(false)
          setShare(result)
        }}
      />

      <BulkUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        existingEmails={existingEmails}
        pods={pods}
        isAdmin={isAdmin}
        podName={managedPod?.name}
      />

      {editing && (
        <EditDialog
          key={editing.id}
          profile={editing}
          isMe={editing.id === meId}
          isAdmin={isAdmin}
          pods={pods}
          onClose={() => setEditing(null)}
          onLink={() => {
            const p = editing
            setEditing(null)
            openLink(p)
          }}
        />
      )}

      <ShareLinkDialog share={share} onClose={() => setShare(null)} />
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
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pod">{role === "manager" ? "Pod they run" : "Pod"}</Label>
        <NativeSelect id="pod" value={podId} onChange={(e) => setPodId(e.target.value)}>
          <option value="">{role === "manager" ? "New pod for them" : "No pod"}</option>
          {pods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      {role === "manager" && (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          {podId
            ? "Each pod has one manager – choosing this replaces the pod’s current manager."
            : "They’ll get their own new pod (e.g. “Pranav’s team”). You can rename it in Pods."}
        </p>
      )}
    </div>
  )
}

function InviteDialog({
  open,
  onOpenChange,
  pods,
  isAdmin,
  podName,
  onInvited,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  pods: Pod[]
  isAdmin: boolean
  podName?: string
  onInvited: (result: JoinLinkResult) => void
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
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
    toast.success(`${name.trim()} added`)
    router.refresh()
    onInvited(res.data!)
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
            <DialogTitle>{isAdmin ? "Add a person" : `Add an intern to ${podName ?? "your pod"}`}</DialogTitle>
            <DialogDescription>Next you’ll get their joining link to send on WhatsApp.</DialogDescription>
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
            <Label htmlFor="inv-phone">WhatsApp number</Label>
            <PhoneInput id="inv-phone" value={phone} onChange={setPhone} />
          </div>
          {isAdmin && <RoleAndPodFields role={role} setRole={setRole} podId={podId} setPodId={setPodId} pods={pods} />}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add and get link"}
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
  isAdmin,
  pods,
  onClose,
  onLink,
}: {
  profile: Profile
  isMe: boolean
  isAdmin: boolean
  pods: Pod[]
  onClose: () => void
  onLink: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(profile.full_name)
  const [phone, setPhone] = useState(profile.phone ?? "")
  const [role, setRole] = useState<TeamRole>(profile.role)
  const [podId, setPodId] = useState(profile.pod_id ?? "")
  const [code, setCode] = useState(profile.referral_code ?? "")
  const [perms, setPerms] = useState<Permission[]>(profile.permissions ?? [])
  const [share, setShareValue] = useState(profile.commission_pct === null ? "" : String(profile.commission_pct))
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
      permissions: perms,
      commission_pct: share,
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
            <Label htmlFor="ed-phone">WhatsApp number</Label>
            <PhoneInput id="ed-phone" value={phone} onChange={setPhone} />
          </div>
          {isAdmin && (
            <>
              <RoleAndPodFields role={role} setRole={setRole} podId={podId} setPodId={setPodId} pods={pods} roleDisabled={isMe} />
              {role === "manager" && (
                <div className="space-y-4 rounded-xl bg-muted/50 p-4">
                  <p className="text-sm font-medium">What this manager can do</p>
                  <p className="-mt-3 text-xs text-muted-foreground">
                    Always: see and help their pod’s leads, sell themselves, the pool and the leaderboard.
                  </p>
                  {PERMISSIONS.map((p) => (
                    <label key={p.key} className="flex items-start justify-between gap-4">
                      <span>
                        <span className="block text-sm">{p.label}</span>
                        <span className="block text-xs text-muted-foreground">{p.hint}</span>
                      </span>
                      <Switch
                        checked={perms.includes(p.key)}
                        onCheckedChange={(on) => setPerms((cur) => (on ? [...cur, p.key] : cur.filter((k) => k !== p.key)))}
                        aria-label={p.label}
                      />
                    </label>
                  ))}
                  <div className="space-y-1.5 border-t pt-4">
                    <Label htmlFor="ed-share">Share of pod’s verified revenue (%)</Label>
                    <Input
                      id="ed-share"
                      inputMode="decimal"
                      value={share}
                      placeholder="e.g. 5"
                      onChange={(e) => setShareValue(e.target.value.replace(/[^0-9.]/g, ""))}
                      className="w-32"
                    />
                    <p className="text-xs text-muted-foreground">Used in their earnings calculator. Leave empty if none.</p>
                  </div>
                </div>
              )}
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
            </>
          )}
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
                <Button variant="outline" size="sm" onClick={onLink}>
                  <Link2 /> {profile.first_login_at ? "New password link" : "Joining link"}
                </Button>
              )}
              {profile.active && isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const outcome = await sendLinksTo([profile.email])
                    if (outcome.sent.length) toast.success(`Login link emailed to ${profile.email}`)
                    else toast.error(describeOutcome(outcome, 1))
                    router.refresh()
                  }}
                >
                  <Mail /> Email a login link
                </Button>
              )}
              {profile.active ? (
                <ConfirmButton
                  label="Deactivate"
                  title={`Deactivate ${profile.full_name}?`}
                  description="They won’t be able to log in, and their open leads go to the pod’s pool. You can turn them back on later."
                  confirmLabel="Deactivate"
                  destructive
                  onConfirm={() => run(() => setMemberActive(profile.id, false), "Deactivated")}
                />
              ) : (
                <Button variant="outline" size="sm" onClick={() => run(() => setMemberActive(profile.id, true), "Reactivated")}>
                  Reactivate
                </Button>
              )}
              {isAdmin && (
                <ConfirmButton
                  label="Delete"
                  variant="destructive"
                  title={`Delete ${profile.full_name} for good?`}
                  description="Use this for test or sample accounts. People with leads or payments can only be deactivated."
                  confirmLabel="Delete"
                  destructive
                  onConfirm={() => run(() => deleteMember(profile.id), "Deleted")}
                />
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

