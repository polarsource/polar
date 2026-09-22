'use client'

import { motion } from 'motion/react'

const EASE = [0.2, 0.8, 0.2, 1] as const

export interface BillMode {
  readonly id: string
  readonly caption: string
  readonly lines: readonly string[]
  readonly total: string
  readonly unit: string
  readonly meter: string
  /** The mode the rest of the chapter follows. */
  readonly chapter?: boolean
}

/**
 * One completion billed three ways. The tokens and the gateway cost are the
 * same; each column is a billing mode's arithmetic and the meter it lands on.
 */
export const BillingModes = ({
  model,
  input,
  output,
  gatewayCost,
  modes,
}: {
  model: string
  input: number
  output: number
  gatewayCost: string
  modes: readonly BillMode[]
}) => (
  <div className="flex h-full flex-col">
    <div className="border-border text-muted-foreground flex items-baseline justify-between gap-3 border-b px-4 py-2.5 font-mono text-[11px] tracking-wide uppercase">
      <span className="text-foreground normal-case">{model}</span>
      <span className="shrink-0 tabular-nums">
        {input.toLocaleString('en-US')} in · {output.toLocaleString('en-US')}{' '}
        out · gateway {gatewayCost}
      </span>
    </div>
    <div className="grid flex-1 grid-cols-1 content-start gap-3 overflow-auto p-4 md:grid-cols-3">
      {modes.map((mode, i) => (
        <motion.div
          key={mode.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.06, ease: EASE }}
          className={`flex flex-col gap-3 rounded-xl border p-3 font-mono text-[11px] ${
            mode.chapter ? 'border-foreground' : 'border-border'
          }`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span>{mode.id}</span>
            <span className="text-muted-foreground">{mode.caption}</span>
          </div>
          <div className="text-muted-foreground flex flex-col gap-0.5">
            {mode.lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <div className="border-border mt-auto flex flex-col gap-0.5 border-t pt-2">
            <span className="text-foreground text-[15px] tabular-nums">
              {mode.total}
              <span className="text-muted-foreground ml-1.5 text-[11px]">
                {mode.unit}
              </span>
            </span>
            <span className="text-muted-foreground">{mode.meter}</span>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
)
