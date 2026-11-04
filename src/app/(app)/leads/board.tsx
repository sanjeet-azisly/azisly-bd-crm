"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { toast } from "sonner"
import { TempChip } from "@/components/leads/chips"
import { OPEN_STAGES, TOUCH_LIMIT, followUpBucket, formatDay, istDate, type Stage } from "@/lib/leads"
import { cn } from "@/lib/utils"
import { setStage } from "./actions"
import type { LeadRow } from "./leads-client"

function useIsWide() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 768px)")
      mq.addEventListener("change", cb)
      return () => mq.removeEventListener("change", cb)
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => true
  )
}

/**
 * The 4 working steps only. Won / Lost / Nurture leads leave the board (they're in List view).
 * Laptop: 4 columns. Phone: 4 step buttons with the chosen step's leads below;
 * press and hold a lead, then drop it on a step to move it.
 */
export function Board({ leads }: { leads: LeadRow[] }) {
  const router = useRouter()
  const wide = useIsWide()
  const [items, setItems] = useState(leads)
  const [dragging, setDragging] = useState<LeadRow | null>(null)
  const [selected, setSelected] = useState<Stage>(() => OPEN_STAGES.find((s) => leads.some((l) => l.stage === s)) ?? "New")
  useEffect(() => setItems(leads), [leads])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  )
  const byStage = (s: Stage) => items.filter((l) => l.stage === s)
  const closedCount = items.filter((l) => !OPEN_STAGES.includes(l.stage)).length

  async function onDragEnd(e: DragEndEvent) {
    setDragging(null)
    const lead = items.find((l) => l.id === e.active.id)
    const stage = e.over?.id as Stage | undefined
    if (!lead || !stage || lead.stage === stage) return
    const before = items
    setItems(items.map((l) => (l.id === lead.id ? { ...l, stage } : l)))
    const res = await setStage(lead.id, { stage, lost_reason: null })
    if (!res.ok) {
      setItems(before)
      toast.error(res.error)
      return
    }
    toast.success(`${lead.name} → ${stage}`)
    router.refresh()
  }

  return (
    <DndContext
      sensors={sensors}
      // Drop where the finger / mouse is, not where the dragged card overlaps most.
      collisionDetection={pointerWithin}
      onDragStart={(e: DragStartEvent) => setDragging(items.find((l) => l.id === e.active.id) ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      {wide ? (
        <div className="grid grid-cols-4 gap-3">
          {OPEN_STAGES.map((stage) => (
            <Column key={stage} stage={stage} leads={byStage(stage)} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Steps">
            {OPEN_STAGES.map((stage) => (
              <StepButton
                key={stage}
                stage={stage}
                count={byStage(stage).length}
                selected={selected === stage}
                onSelect={() => setSelected(stage)}
              />
            ))}
          </div>
          <div className="space-y-2">
            {byStage(selected).map((l) => (
              <DraggableCard key={l.id} lead={l} />
            ))}
            {byStage(selected).length === 0 && (
              <p className="rounded-2xl bg-surface p-8 text-center text-sm text-muted-foreground">No leads here.</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Press and hold a lead, then drop it on a step to move it.</p>
        </div>
      )}
      {closedCount > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {closedCount} closed {closedCount === 1 ? "lead" : "leads"} (Won, Lost, Nurture) are in List view.
        </p>
      )}
      <DragOverlay dropAnimation={null}>{dragging && <CardBody lead={dragging} lifted />}</DragOverlay>
    </DndContext>
  )
}

function Column({ stage, leads }: { stage: Stage; leads: LeadRow[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  return (
    <section
      ref={setNodeRef}
      aria-label={stage}
      className={cn("flex min-w-0 flex-col rounded-xl bg-[#f6f7f9] p-3 transition-shadow", isOver && "ring-2 ring-brand")}
    >
      <h2 className="flex items-center justify-between px-1 pb-2 text-sm font-semibold">
        {stage}
        <span className="rounded-full bg-white px-2 text-xs font-normal text-muted-foreground">{leads.length}</span>
      </h2>
      <div className="flex min-h-40 flex-col gap-2">
        {leads.map((l) => (
          <DraggableCard key={l.id} lead={l} />
        ))}
      </div>
    </section>
  )
}

function StepButton({
  stage,
  count,
  selected,
  onSelect,
}: {
  stage: Stage
  count: number
  selected: boolean
  onSelect: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  return (
    <button
      ref={setNodeRef}
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-2xl px-1 py-3 text-xs leading-tight font-medium",
        selected ? "bg-brand text-white" : "bg-surface",
        isOver && "scale-105 border-brand bg-brand text-white"
      )}
    >
      <span className="font-heading text-base">{count}</span>
      <span className="text-center">{stage}</span>
    </button>
  )
}

function DraggableCard({ lead }: { lead: LeadRow }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn("touch-manipulation", isDragging && "opacity-30")}>
      <CardBody lead={lead} />
    </div>
  )
}

function CardBody({ lead, lifted = false }: { lead: LeadRow; lifted?: boolean }) {
  const today = istDate()
  const overdue = followUpBucket(lead.next_follow_up, today) === "overdue"
  return (
    <div
      className={cn(
        "rounded-xl bg-white p-4 text-sm ring-1 ring-[#e9ebf0]",
        lifted && "rotate-2 shadow-xl"
      )}
    >
      <Link href={`/leads/${lead.id}`} className="line-clamp-2 leading-snug font-medium hover:underline">
        {lead.name}
      </Link>
      <p className="truncate text-xs text-muted-foreground">{lead.course_short ?? "No course yet"}</p>
      {/* Overdue shows as red text only – no stripes or outlines. */}
      {lead.next_follow_up && (
        <p className={cn("mt-2 text-xs", overdue ? "font-medium text-[#dc2626]" : "text-muted-foreground")}>
          {overdue ? "Overdue · " : "Follow up · "}
          {formatDay(lead.next_follow_up, today)}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-1">
        <TempChip temperature={lead.temperature} />
        <span className="text-xs text-muted-foreground">
          {Math.min(lead.touches, TOUCH_LIMIT)}/{TOUCH_LIMIT} touches
        </span>
      </div>
    </div>
  )
}
