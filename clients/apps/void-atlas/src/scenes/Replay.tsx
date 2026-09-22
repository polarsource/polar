'use client'

import { motion } from 'motion/react'
import { useState } from 'react'
import {
  cumulative,
  dollars,
  gb,
  perGb,
  replay,
  type Customer,
  type Levers,
} from './scenario'

const EASE = [0.2, 0.8, 0.2, 1] as const
const GB = 1_000_000_000
const CHART_W = 320
const CHART_H = 110
const PAD = 4

export const Delta = ({ value }: { value: number }) => (
  <span
    className={
      value > 0.005
        ? 'text-amber-600 dark:text-amber-400'
        : value < -0.005
          ? 'text-emerald-700 dark:text-emerald-300'
          : 'text-muted-foreground'
    }
  >
    {Math.abs(value) < 0.005
      ? '='
      : `${value > 0 ? '+' : '−'}${dollars(Math.abs(value))}`}
  </span>
)

const Slider = ({
  label,
  value,
  shown,
  baseline,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  shown: string
  baseline: string
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) => (
  <label className="flex flex-col gap-1">
    <span className="flex items-baseline justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>
        <span className="text-muted-foreground mr-2 line-through">
          {baseline !== shown && baseline}
        </span>
        {shown}
      </span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="accent-foreground h-1 w-full cursor-ew-resize"
    />
  </label>
)

const points = (series: number[], scale: number) =>
  series
    .map((value, index) => {
      const x = PAD + (index / (series.length - 1)) * (CHART_W - PAD * 2)
      const y = CHART_H - PAD - (value / scale) * (CHART_H - PAD * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

const Chart = ({ base, scenario }: { base: number[]; scenario: number[] }) => {
  const scale = Math.max(...base, ...scenario)
  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      preserveAspectRatio="none"
      className="h-40 w-full"
      role="img"
      aria-label="Cumulative revenue over 30 days, active version against scenario"
    >
      <line
        x1={PAD}
        x2={CHART_W - PAD}
        y1={CHART_H - PAD}
        y2={CHART_H - PAD}
        className="stroke-border"
      />
      <polyline
        points={points(base, scale)}
        fill="none"
        strokeWidth={1.5}
        strokeDasharray="3 3"
        className="stroke-muted-foreground"
        vectorEffect="non-scaling-stroke"
      />
      <motion.polyline
        initial={false}
        animate={{ points: points(scenario, scale) }}
        transition={{ duration: 0.3, ease: EASE }}
        fill="none"
        strokeWidth={1.5}
        className="stroke-foreground"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/**
 * The Simulate view's heart: three sliders over the scenario's levers, a
 * chart of the month's revenue under both price books, and each customer's
 * bill. Everything recomputes as the reader drags.
 */
export const Replay = ({
  base,
  scenario,
  customers,
}: {
  base: Levers
  scenario: Levers
  customers: readonly Customer[]
}) => {
  const [levers, setLevers] = useState(scenario)
  const result = replay(base, levers, customers)
  const series = {
    base: cumulative(base, customers),
    scenario: cumulative(levers, customers),
  }
  const set = (patch: Partial<Levers>) =>
    setLevers((current) => ({ ...current, ...patch }))

  return (
    <div className="flex flex-col gap-4 font-mono text-[11px]">
      <div className="flex flex-col gap-3">
        <Slider
          label="pro · price"
          value={levers.fee}
          shown={`${dollars(levers.fee)} / mo`}
          baseline={`${dollars(base.fee)} / mo`}
          min={0}
          max={99}
          step={1}
          onChange={(fee) => set({ fee })}
        />
        <Slider
          label="pro · allowance"
          value={levers.included / GB}
          shown={gb(levers.included)}
          baseline={gb(base.included)}
          min={0}
          max={200}
          step={5}
          onChange={(value) => set({ included: value * GB })}
        />
        <Slider
          label="bandwidth · overage"
          value={Math.round(levers.unitAmount * GB * 100)}
          shown={perGb(levers.unitAmount)}
          baseline={perGb(base.unitAmount)}
          min={0}
          max={30}
          step={1}
          onChange={(value) => set({ unitAmount: value / 100 / GB })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground">revenue · 30 days</span>
          <span className="flex items-baseline gap-3">
            <span className="text-muted-foreground">
              ┄ {dollars(result.base)}
            </span>
            <span>— {dollars(result.scenario)}</span>
            <span className="w-16 text-right">
              <Delta value={result.scenario - result.base} />
            </span>
          </span>
        </div>
        <Chart base={series.base} scenario={series.scenario} />
      </div>

      <ul className="border-border flex flex-col gap-1 border-t pt-2">
        {result.rows.map((row) => (
          <li
            key={row.name}
            className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-3"
          >
            <span className="truncate">
              {row.name}
              <span className="text-muted-foreground ml-2">
                {gb(row.usage)}
              </span>
            </span>
            <span className="text-muted-foreground">{dollars(row.base)}</span>
            <span>{dollars(row.scenario)}</span>
            <span className="w-16 text-right">
              <Delta value={row.delta} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
