'use client'

import { AnimatePresence, motion } from 'motion/react'
import { latch, thresholds, type IrSignal, type Observation } from './latch'

const EASE = [0.2, 0.8, 0.2, 1] as const

export interface Evidence {
  readonly events: number
  readonly identities: number
  readonly totals: Record<string, number>
  readonly values: Record<string, readonly string[]>
  readonly stale?: boolean
}

const fmt = (value: number | null, semantic: boolean) =>
  value === null
    ? 'null'
    : semantic
      ? value.toFixed(2)
      : value.toLocaleString('en-US')

const tone = (status: Observation['status']) =>
  status === 'active'
    ? 'bg-red-500'
    : status === 'inactive'
      ? 'bg-emerald-500'
      : 'bg-muted-foreground'

/**
 * Observations of one signal over time against its two thresholds. Points
 * are coloured by the latched status; the band between the thresholds is
 * where nothing changes. Semantic signals show the question and what Jev saw.
 */
export const SignalLatch = ({
  signal,
  values,
  slots = 6,
  provisional = [],
  evidence,
}: {
  signal: IrSignal
  values: readonly (number | null)[]
  /** How many observations the chart makes room for. */
  slots?: number
  /** Indices whose value includes unconfirmed local events. */
  provisional?: readonly number[]
  evidence?: Evidence
}) => {
  const semantic = signal.kind === 'semantic'
  const observations = latch(signal, values)
  const { enter, exit, direction } = thresholds(signal)
  const max = semantic ? 1 : Math.max(exit * 1.3, ...values.map((v) => v ?? 0))
  const y = (value: number) => 100 - (value / max) * 100
  const x = (index: number) => ((index + 0.5) / slots) * 100
  const latest = observations.at(-1)
  const points = observations.filter(
    (o): o is Observation & { value: number } => o.value !== null,
  )
  const band = {
    top: y(Math.max(enter, exit)),
    bottom: y(Math.min(enter, exit)),
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex items-baseline justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span>
          signal <span className="font-medium">{signal.slug}</span>
          <span className="text-muted-foreground">
            {' '}
            · {signal.kind} · {signal.meter}
          </span>
        </span>
        <span className="text-muted-foreground">
          {direction === 'below'
            ? `enter < ${fmt(enter, false)} · exit ≥ ${fmt(exit, false)}`
            : `enter > ${fmt(enter, true)} · exit < ${fmt(exit, true)}`}
        </span>
      </div>

      {semantic && (
        <div className="border-border border-b px-4 py-2.5 font-mono text-xs">
          <span className="text-muted-foreground">when </span>
          <span>&ldquo;{signal.when}&rdquo;</span>
          <span className="text-muted-foreground">
            {' '}
            over the last {signal.over.amount} {signal.over.unit}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4 overflow-hidden px-4 py-4">
        <div className="relative min-h-[150px] flex-1">
          <div
            className="absolute inset-x-0 bg-amber-500/10"
            style={{ top: `${band.top}%`, bottom: `${100 - band.bottom}%` }}
          />
          {[
            {
              value: enter,
              label: `enter ${direction === 'below' ? '<' : '>'} ${fmt(enter, semantic)}`,
            },
            {
              value: exit,
              label: `exit ${direction === 'below' ? '≥' : '<'} ${fmt(exit, semantic)}`,
            },
          ].map((line) => (
            <div
              key={line.label}
              className="border-foreground/30 absolute inset-x-0 border-t border-dashed"
              style={{ top: `${y(line.value)}%` }}
            >
              <span className="text-muted-foreground absolute right-0 -translate-y-full pb-0.5 font-mono text-[10px]">
                {line.label}
              </span>
            </div>
          ))}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {points.length > 1 && (
              <polyline
                fill="none"
                className="stroke-foreground/40"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                points={points
                  .map((o) => `${x(o.index)},${y(o.value)}`)
                  .join(' ')}
              />
            )}
          </svg>
          <AnimatePresence initial={false}>
            {observations.map((o) => (
              <motion.div
                key={o.index}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                style={{
                  left: `${x(o.index)}%`,
                  top: `${o.value === null ? 50 : y(o.value)}%`,
                }}
              >
                <span
                  className={`ring-card size-3 rounded-full ring-2 ${tone(o.status)} ${
                    provisional.includes(o.index)
                      ? 'ring-dashed opacity-60'
                      : ''
                  }`}
                />
                <span className="font-mono text-[10px] whitespace-nowrap tabular-nums">
                  {fmt(o.value, semantic)}
                </span>
                {o.transition && (
                  <span
                    className={`rounded px-1 font-mono text-[10px] ${
                      o.transition === 'entered'
                        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                        : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                    }`}
                  >
                    {o.transition}
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="border-border grid grid-cols-3 gap-3 rounded-xl border p-3 font-mono text-xs">
          {[
            ['status', latest?.status ?? '—'],
            ['transition', latest?.transition ?? 'null'],
            [
              semantic ? 'noul' : 'balance.remaining',
              latest ? fmt(latest.value, semantic) : '—',
            ],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                {label}
              </span>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={value}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className={
                    label === 'status'
                      ? value === 'active'
                        ? 'text-red-600 dark:text-red-400'
                        : value === 'inactive'
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-muted-foreground'
                      : ''
                  }
                >
                  {value}
                </motion.span>
              </AnimatePresence>
            </div>
          ))}
        </div>

        <AnimatePresence initial={false}>
          {evidence && (
            <motion.div
              key="evidence"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="border-border text-muted-foreground flex flex-col gap-1 rounded-xl border p-3 font-mono text-[11px]"
            >
              <div className="flex justify-between">
                <span className="text-foreground">evidence</span>
                {evidence.stale && (
                  <span>stale: true · answered under a minute ago</span>
                )}
              </div>
              <span>
                {evidence.events} events · {evidence.identities} identity ·{' '}
                {Object.entries(evidence.totals)
                  .map(([k, v]) => `${k} ${v.toLocaleString('en-US')}`)
                  .join(' · ')}
              </span>
              {Object.entries(evidence.values).map(([k, v]) => (
                <span key={k}>
                  {k}: {v.join(', ')}
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
