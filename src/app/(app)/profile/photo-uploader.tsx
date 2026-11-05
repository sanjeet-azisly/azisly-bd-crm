"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Loader2, Minus, Plus, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { uploadIdPhoto } from "./actions"

// Passport size is 35 × 45 mm. The frame on screen and the saved file share that shape.
const FRAME_W = 252
const FRAME_H = 324
const OUT_W = 700
const OUT_H = 900

type Picked = { url: string; w: number; h: number }

function clamp(v: number, limit: number) {
  return Math.max(-limit, Math.min(limit, v))
}

export function PhotoUploader({ currentUrl }: { currentUrl: string | null }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)

  useEffect(() => () => void (picked && URL.revokeObjectURL(picked.url)), [picked])

  // Scale that makes the photo just cover the frame, then the person's zoom on top.
  const scale = picked ? Math.max(FRAME_W / picked.w, FRAME_H / picked.h) * zoom : 1
  const limits = picked
    ? { x: Math.max(0, (picked.w * scale - FRAME_W) / 2), y: Math.max(0, (picked.h * scale - FRAME_H) / 2) }
    : { x: 0, y: 0 }
  const pos = { x: clamp(offset.x, limits.x), y: clamp(offset.y, limits.y) }

  function choose(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) return toast.error("Choose a photo (JPG or PNG).")
    const url = URL.createObjectURL(file)
    const probe = new Image()
    probe.onload = () => {
      if (probe.naturalWidth < 300 || probe.naturalHeight < 300) {
        URL.revokeObjectURL(url)
        return toast.error("That photo is too small. Use a clearer, larger photo.")
      }
      setPicked({ url, w: probe.naturalWidth, h: probe.naturalHeight })
      setZoom(1)
      setOffset({ x: 0, y: 0 })
    }
    probe.onerror = () => {
      URL.revokeObjectURL(url)
      toast.error("This photo type can’t be opened here. Try a JPG or PNG (on iPhone, take a screenshot of it).")
    }
    probe.src = url
  }

  async function save() {
    if (!picked || !img.current) return
    setSaving(true)
    try {
      const canvas = document.createElement("canvas")
      canvas.width = OUT_W
      canvas.height = OUT_H
      const ctx = canvas.getContext("2d")!
      const k = OUT_W / FRAME_W
      const w = picked.w * scale * k
      const h = picked.h * scale * k
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, OUT_W, OUT_H)
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(img.current, (OUT_W - w) / 2 + pos.x * k, (OUT_H - h) / 2 + pos.y * k, w, h)
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9))
      if (!blob) throw new Error("Couldn’t prepare the photo.")
      const form = new FormData()
      form.append("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }))
      const res = await uploadIdPhoto(form)
      if (!res.ok) return toast.error(res.error)
      toast.success("Photo saved. Thank you!")
      setPicked(null)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn’t save the photo.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-8">
      <div
        className="relative shrink-0 touch-none overflow-hidden rounded-xl bg-[#f5f6f8] select-none"
        style={{ width: FRAME_W, height: FRAME_H, boxShadow: "0 0 0 1px #e9ebf0", cursor: picked ? "grab" : undefined }}
        onPointerDown={(e) => {
          if (!picked) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (d) setOffset({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y })
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {picked ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={img}
              src={picked.url}
              alt="Your photo"
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{
                width: picked.w * scale,
                height: picked.h * scale,
                left: (FRAME_W - picked.w * scale) / 2 + pos.x,
                top: (FRAME_H - picked.h * scale) / 2 + pos.y,
              }}
            />
            {/* Face guide: head should sit inside the oval. */}
            <svg className="pointer-events-none absolute inset-0" viewBox={`0 0 ${FRAME_W} ${FRAME_H}`} aria-hidden>
              <ellipse
                cx={FRAME_W / 2}
                cy={FRAME_H * 0.42}
                rx={FRAME_W * 0.3}
                ry={FRAME_H * 0.3}
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeDasharray="6 6"
                opacity="0.9"
              />
            </svg>
          </>
        ) : currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="Your ID card photo" className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Camera className="size-8" />
            <span className="text-sm">No photo yet</span>
          </div>
        )}
      </div>

      <div className="flex w-full max-w-xs flex-col gap-4">
        {picked ? (
          <>
            <p className="text-sm text-muted-foreground">
              Drag the photo to move it and use the slider to zoom, so your face sits inside the dotted oval.
            </p>
            <div className="flex items-center gap-3">
              <Minus className="size-4 text-muted-foreground" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Zoom"
                className="flex-1 accent-brand"
              />
              <Plus className="size-4 text-muted-foreground" />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Save photo
              </Button>
              <Button variant="ghost" onClick={() => setPicked(null)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={() => input.current?.click()} className="self-start">
            <Upload />
            {currentUrl ? "Change photo" : "Upload photo"}
          </Button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            choose(e.target.files?.[0])
            e.target.value = ""
          }}
        />
      </div>
    </div>
  )
}
