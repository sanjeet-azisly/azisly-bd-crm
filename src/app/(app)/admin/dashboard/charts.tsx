"use client"

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatINR } from "@/lib/format"

const BRAND = "#2346F5"
const GRID = "#e5e5ea"
const INK_MUTED = "#86868b"

const compactINR = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 ? 1 : 0)}L` : n >= 1000 ? `₹${Math.round(n / 1000)}K` : `₹${n}`

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { value: number }[]; label?: string; unit: "inr" | "count" }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{unit === "inr" ? formatINR(payload[0].value) : payload[0].value}</p>
    </div>
  )
}

/** Revenue per program month as columns; a target tick on each month when targets are set. */
export function MonthColumns({ data }: { data: { month: string; revenue: number; target: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: INK_MUTED, fontSize: 12 }} />
        <YAxis tickFormatter={compactINR} tickLine={false} axisLine={false} width={48} tick={{ fill: INK_MUTED, fontSize: 12 }} />
        <Tooltip cursor={{ fill: "#f2f2f7" }} content={<ChartTooltip unit="inr" />} />
        <Bar isAnimationActive={false} dataKey="revenue" fill={BRAND} maxBarSize={24} radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 11, fill: "#6e6e73", formatter: (v: unknown) => (Number(v) ? compactINR(Number(v)) : "") }} />
        {data
          .filter((d) => d.target)
          .map((d) => (
            <ReferenceLine
              key={d.month}
              segment={[
                { x: d.month, y: d.target! },
                { x: d.month, y: d.target! },
              ]}
              stroke="#0C1B3D"
              strokeWidth={2}
              ifOverflow="extendDomain"
            />
          ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Ranked horizontal bars for one measure (course, source, pod, funnel step). */
export function RankedBars({ data, unit }: { data: { name: string; value: number }[]; unit: "inr" | "count" }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No data yet.</p>
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36 + 16)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#6e6e73", fontSize: 12 }}
        />
        <Tooltip cursor={{ fill: "#f2f2f7" }} content={<ChartTooltip unit={unit} />} />
        <Bar
          isAnimationActive={false}
          dataKey="value"
          fill={BRAND}
          maxBarSize={20}
          radius={[0, 4, 4, 0]}
          label={{
            position: "right",
            fontSize: 11,
            fill: "#6e6e73",
            formatter: (v: unknown) => (unit === "inr" ? compactINR(Number(v)) : String(v)),
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
