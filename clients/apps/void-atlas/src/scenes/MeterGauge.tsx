'use client'

import type { IrMeter } from '@void/sdk/config'
import { AnimatePresence, motion } from 'motion/react'
import { check as runCheck, standing, type Holder } from './balance'

const EASE = [0.2, 0.8, 0.2, 1] as const

const n = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('en-US')
const money = (amount: number, currency: string) =>
  `${currency === 'usd' ? '$' : `${currency} `}${
    amount === 0
      ? '0'
      : amount < 0.01
        ? amount.toFixed(8).replace(/0+$/, '')
        : amount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })
  }`

const Value = ({ children }: { children: string }) => (
  <AnimatePresence mode="popLayout" initial={false}>
    <motion.span
      key={children}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="font-mono text-[13px] tabular-nums"
    >
      {children}
    </motion.span>
  </AnimatePresence>
)

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
      {label}
    </span>
    <Value>{value}</Value>
  </div>
)

/**
 * One holder's standing on one meter: a bar of credits with usage filled
 * in, the numbers `balance()` returns, and, when a step asks, the result of
 * `check({ estimate })`. Everything is computed from the compiled meter and
 * product term the reader just wrote.
 */
export const MeterGauge = ({
  meter,
  holder,
  usage,
  unit,
  estimate,
}: {
  meter: IrMeter
  holder: Holder
  usage: number
  unit: string
  estimate?: number
}) => {
  const now = standing(holder, usage)
  const result =
    estimate === undefined ? null : runCheck(meter, holder, usage, estimate)
  const scale = Math.max(now.credits, usage + (estimate ?? 0), 1)
  const pct = (value: number) => `${Math.min(100, (value / scale) * 100)}%`
  const used = Math.min(usage, now.credits)
  const over = Math.max(0, usage - now.credits)
  const pending = result?.allowed ? estimate! : 0

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex items-baseline justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span>
          meter <span className="font-medium">{meter.slug}</span>
        </span>
        <span className="text-muted-foreground">
          {money(meter.unit_amount, meter.currency)} / {unit.replace(/s$/, '')}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-auto px-4 py-5">
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground flex justify-between font-mono text-[11px] tracking-wide uppercase">
            <span>
              {holder.kind === 'none'
                ? 'no holder'
                : holder.kind === 'credits'
                  ? `${holder.id} · prepaid`
                  : `${holder.id} · ${holder.term.limit}`}
            </span>
            <span className="tabular-nums">
              {now.credits > 0 ? `${n(now.credits)} ${unit}` : ''}
            </span>
          </div>
          <div className="bg-muted relative h-4 overflow-hidden rounded-full">
            {now.credits > 0 && (
              <motion.div
                layout
                className="border-border absolute inset-y-0 left-0 rounded-full border border-dashed"
                animate={{ width: pct(now.credits) }}
                transition={{ duration: 0.4, ease: EASE }}
              />
            )}
            <motion.div
              className="bg-foreground absolute inset-y-0 left-0 rounded-l-full"
              initial={false}
              animate={{ width: pct(used) }}
              transition={{ duration: 0.4, ease: EASE }}
            />
            <motion.div
              className="absolute inset-y-0 bg-red-500"
              initial={false}
              animate={{ left: pct(used), width: pct(over) }}
              transition={{ duration: 0.4, ease: EASE }}
            />
            <motion.div
              className={`absolute inset-y-0 ${
                result && result.overageAfter > 0
                  ? 'bg-red-500/40'
                  : 'bg-foreground/30'
              }`}
              initial={false}
              animate={{ left: pct(usage), width: pct(pending) }}
              transition={{ duration: 0.4, ease: EASE }}
            />
          </div>
          <div className="text-muted-foreground flex justify-between font-mono text-[11px]">
            <span>{n(usage)} used</span>
            {now.overage > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {n(now.overage)} over ·{' '}
                {money(now.overage * meter.unit_amount, meter.currency)}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Stat label="usage" value={n(now.usage)} />
          <Stat label="credits" value={n(now.credits)} />
          <Stat label="remaining" value={n(now.remaining)} />
          <Stat label="limit" value={now.limit ?? '—'} />
          <Stat label="limited by" value={now.limitedBy ?? '—'} />
          <Stat label="reason" value={now.reason} />
        </div>

        <AnimatePresence initial={false}>
          {result && (
            <motion.div
              key="check"
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3, ease: EASE }}
              className={`flex flex-col gap-2 rounded-xl border p-3 font-mono text-xs ${
                result.allowed
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
                  : 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span>check({`{ estimate: ${n(result.estimate)} }`})</span>
                <span
                  className={
                    result.allowed
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-red-700 dark:text-red-300'
                  }
                >
                  {result.allowed ? 'allowed' : 'denied'}
                </span>
              </div>
              <div className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1">
                <span>reason</span>
                <span className="text-right">{result.reason}</span>
                <span>remaining</span>
                <span className="text-right">{n(result.remaining)}</span>
                <span>limitedBy</span>
                <span className="text-right">{result.limitedBy ?? 'null'}</span>
                {result.allowed && result.overageAfter > 0 && (
                  <>
                    <span>bills</span>
                    <span className="text-right">
                      {n(result.overageAfter)} ×{' '}
                      {money(meter.unit_amount, meter.currency)} ={' '}
                      {money(result.overageCost, meter.currency)}
                    </span>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
