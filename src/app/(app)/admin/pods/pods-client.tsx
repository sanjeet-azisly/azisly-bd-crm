"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Crown, Pencil, Plus, UserMinus } from "lucide-react"
import { toast } from "sonner"
import { Chip } from "@/components/chip"
import { ConfirmButton } from "@/components/confirm-button"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { formatINR } from "@/lib/format"
import type { Pod, Profile } from "@/lib/types"
import { cn } from "@/lib/utils"
import { assignToPod, createPod, deletePod, setPodLeader, updatePod } from "./actions"

const SWATCHES = ["#2346F5", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#0C1B3D"]

type Props = { pods: Pod[]; people: Profile[]; defaultMilestone: number }

export function PodsClient({ pods, people, defaultMilestone }: Props) {
  const [editing, setEditing] = useState<Pod | "new" | null>(null)
  const unassigned = people.filter((p) => !p.pod_id)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {pods.length} pods · {unassigned.length} {unassigned.length === 1 ? "person" : "people"} not in a pod
        </p>
        <Button onClick={() => setEditing("new")}>
          <Plus /> New pod
        </Button>
      </div>

      {pods.length === 0 && (
        <p className="rounded-2xl bg-surface p-8 text-center text-sm text-muted-foreground">
          No pods yet. Create one, then add members.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {pods.map((pod) => (
          <PodCard
            key={pod.id}
            pod={pod}
            members={people.filter((p) => p.pod_id === pod.id)}
            others={people.filter((p) => p.pod_id !== pod.id)}
            pods={pods}
            defaultMilestone={defaultMilestone}
            onEdit={() => setEditing(pod)}
          />
        ))}
      </div>

      {editing && (
        <PodDialog key={editing === "new" ? "new" : editing.id} pod={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function PodCard({
  pod,
  members,
  others,
  pods,
  defaultMilestone,
  onEdit,
}: {
  pod: Pod
  members: Profile[]
  others: Profile[]
  pods: Pod[]
  defaultMilestone: number
  onEdit: () => void
}) {
  const router = useRouter()
  const [adding, setAdding] = useState("")
  const leader = members.find((m) => m.id === pod.leader_id)
  const interns = members.filter((m) => m.role === "intern").length
  const podName = (id: string | null) => pods.find((p) => p.id === id)?.name

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    const res = await fn()
    if (!res.ok) return toast.error(res.error ?? "Something went wrong")
    toast.success(success)
    router.refresh()
  }

  return (
    <section className="overflow-hidden rounded-2xl bg-surface">
      <div className="h-1.5" style={{ background: pod.colour }} />
      <div className="space-y-6 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{pod.name}</h2>
            <p className="text-sm text-muted-foreground">
              Manager: {leader ? leader.full_name : <span className="text-muted-foreground">none yet</span>} · {interns}{" "}
              {interns === 1 ? "intern" : "interns"}
            </p>
            <p className="text-sm text-muted-foreground">
              Target:{" "}
              {pod.target_override !== null
                ? `${formatINR(pod.target_override)} (set by admin)`
                : `${formatINR(interns * defaultMilestone)} (sum of interns’ milestones)`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil /> Edit
          </Button>
        </div>

        <ul className="divide-y rounded-lg border">
          {members.map((m) => {
            const isLeader = m.id === pod.leader_id
            return (
              <li key={m.id} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {m.full_name}{" "}
                  {isLeader && (
                    <Chip tone="brand" className="ml-1">
                      <Crown className="size-3" /> Manager
                    </Chip>
                  )}
                  {!isLeader && m.role === "manager" && <span className="text-xs text-muted-foreground">(manager)</span>}
                </span>
                {isLeader ? (
                  <Button variant="ghost" size="xs" onClick={() => run(() => setPodLeader(pod.id, null), "Manager removed from this pod")}>
                    Unmark
                  </Button>
                ) : (
                  m.role === "manager" && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => run(() => setPodLeader(pod.id, m.id), `${m.full_name} now runs ${pod.name}`)}
                    >
                      <Crown /> Make pod’s manager
                    </Button>
                  )
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${m.full_name} from ${pod.name}`}
                  title="Remove from pod"
                  onClick={() => run(() => assignToPod(m.id, null), `${m.full_name} removed from ${pod.name}`)}
                >
                  <UserMinus />
                </Button>
              </li>
            )
          })}
          {members.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">No members yet.</li>}
        </ul>

        {others.length > 0 && (
          <div className="flex gap-2">
            <div className="flex-1">
              <NativeSelect aria-label={`Add a member to ${pod.name}`} value={adding} onChange={(e) => setAdding(e.target.value)}>
                <option value="">Add a member…</option>
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                    {p.pod_id ? ` (now in ${podName(p.pod_id)})` : ""}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button
              variant="secondary"
              className="h-10"
              disabled={!adding}
              onClick={async () => {
                await run(() => assignToPod(adding, pod.id), "Member added")
                setAdding("")
              }}
            >
              Add
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

function PodDialog({ pod, onClose }: { pod: Pod | null; onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState(pod?.name ?? "")
  const [colour, setColour] = useState(pod?.colour ?? SWATCHES[0])
  const [target, setTarget] = useState(pod?.target_override?.toString() ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = target.replace(/[,\s₹]/g, "")
    if (trimmed && !/^\d+$/.test(trimmed)) return setError("Target must be a whole number of rupees.")
    setBusy(true)
    setError(null)
    const payload = { name, colour, target_override: trimmed ? Number(trimmed) : null }
    const res = pod ? await updatePod(pod.id, payload) : await createPod(payload)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    toast.success(pod ? "Pod saved" : "Pod created")
    router.refresh()
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={save} className="space-y-6" noValidate>
          <DialogHeader>
            <DialogTitle>{pod ? `Edit ${pod.name}` : "New pod"}</DialogTitle>
            <DialogDescription>Members and the manager are set on the pod card.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="pod-name">Pod name</Label>
            <Input id="pod-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Colour</legend>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  aria-pressed={colour.toLowerCase() === c.toLowerCase()}
                  onClick={() => setColour(c)}
                  className={cn(
                    "size-8 rounded-full ring-offset-2",
                    colour.toLowerCase() === c.toLowerCase() && "ring-2 ring-navy"
                  )}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                aria-label="Custom colour"
                value={colour}
                onChange={(e) => setColour(e.target.value)}
                className="size-8 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="pod-target">Monthly pod target override (₹, optional)</Label>
            <Input
              id="pod-target"
              inputMode="numeric"
              placeholder="Leave empty to use the sum of members’ milestones"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="sm:justify-between">
            {pod ? (
              <ConfirmButton
                label="Delete pod"
                variant="destructive"
                size="default"
                title={`Delete ${pod.name}?`}
                description="Its members stay on the team but won’t be in any pod until you move them."
                confirmLabel="Delete pod"
                destructive
                onConfirm={async () => {
                  const res = await deletePod(pod.id)
                  if (!res.ok) return void toast.error(res.error)
                  toast.success("Pod deleted")
                  router.refresh()
                  onClose()
                }}
              />
            ) : (
              <span />
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : pod ? "Save" : "Create pod"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
