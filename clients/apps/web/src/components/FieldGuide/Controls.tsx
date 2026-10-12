'use client'

import type { Control } from './content'
import {
  GRANT_CHOICES,
  RATE_CHOICES,
  TRAFFIC_CHOICES,
  num,
  setGrant,
  setRate,
  setTraffic,
  useSim,
} from './simulation'

/** A row of choices set as text, the chosen one inverted. */
function Choice<T extends string | number>({
  label,
  note,
  options,
  value,
  format,
  onChange,
}: {
  label: string
  note?: string
  options: readonly T[]
  value: T
  format: (v: T) => string
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-1 text-[13px]">
      <span className="font-medium">{label}</span>
      {note ? <span className="text-[#7b7b7b]">{note}</span> : null}
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            aria-pressed={o === value}
            className={`cursor-pointer border-0 p-0 px-1 font-mono text-[13px] ${
              o === value
                ? 'bg-[#d8d8d8] text-[#141414]'
                : 'bg-transparent text-[#d8d8d8] hover:text-white'
            }`}
            onClick={() => onChange(o)}
          >
            {format(o)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The control a chapter puts on the page, wired to the stream under the manual. */
export function Controls({ kind }: { kind: Control }) {
  const sim = useSim((s) => s)
  if (kind === 'traffic')
    return (
      <Choice
        label="Choose traffic"
        note="How fast events arrive on the ledger."
        options={TRAFFIC_CHOICES}
        value={sim.traffic}
        format={(t) => t.toUpperCase()}
        onChange={setTraffic}
      />
    )
  if (kind === 'rate')
    return (
      <Choice
        label="Choose the rate for tokens.out"
        note="USD per million tokens. Every reading below is priced at it."
        options={RATE_CHOICES}
        value={Math.round(sim.rates['tokens.out'] * 1_000_000)}
        format={(r) => `$${r}`}
        onChange={setRate}
      />
    )
  return (
    <Choice
      label="Choose the grant"
      note="Credits added each time the balance would cross zero."
      options={GRANT_CHOICES}
      value={sim.grant}
      format={num}
      onChange={setGrant}
    />
  )
}
