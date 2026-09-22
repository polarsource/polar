'use client'

import { AnimatePresence, motion } from 'motion/react'
import { inLocalStorage, onServer, reconcile, type Row } from './ledger'

const EASE = [0.2, 0.8, 0.2, 1] as const

const n = (value: number) => value.toLocaleString('en-US')

const STATE: Record<Row['state'], { label: string; className: string }> = {
  local: {
    label: 'awaiting receipt',
    className: 'text-amber-600 dark:text-amber-400',
  },
  confirmed: {
    label: 'counted',
    className: 'text-emerald-700 dark:text-emerald-300',
  },
  pending: {
    label: 'upload failed · kept',
    className: 'text-amber-600 dark:text-amber-400',
  },
  rejected: {
    label: 'rejected 4xx · excluded',
    className: 'text-red-600 dark:text-red-400',
  },
  pruned: {
    label: 'past retention · swept',
    className: 'text-muted-foreground',
  },
}

const Ledger = ({
  title,
  subtitle,
  rows,
  empty,
}: {
  title: string
  subtitle: string
  rows: readonly Row[]
  empty: string
}) => (
  <div className="flex min-h-0 flex-col">
    <div className="border-border text-muted-foreground flex items-baseline justify-between border-b px-4 py-2.5 font-mono text-[11px] tracking-wide uppercase">
      <span>{title}</span>
      <span className="normal-case">{subtitle}</span>
    </div>
    <ul className="flex flex-col gap-1.5 overflow-auto px-4 py-3">
      <AnimatePresence initial={false}>
        {rows.map((row) => (
          <motion.li
            key={row.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: row.state === 'pruned' ? 0.4 : 1, y: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.3, ease: EASE }}
            className={`border-border flex flex-col gap-0.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] ${
              row.state === 'rejected' ? 'line-through' : ''
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span>credits.used · {row.id}</span>
              <span className="tabular-nums">−{n(row.amount)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className={STATE[row.state].className}>
                {STATE[row.state].label}
              </span>
              {row.note && (
                <span className="text-muted-foreground truncate">
                  {row.note}
                </span>
              )}
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
      {rows.length === 0 && (
        <li className="text-muted-foreground py-1 font-mono text-xs">
          {empty}
        </li>
      )}
    </ul>
  </div>
)

/**
 * The SDK's local buffer on the left, the server's ledger on the right, and
 * the balance a check would compute from both. A recorded event lands on
 * the left and moves the balance at once; a receipt moves it to the right.
 */
export const TwoLedgers = ({
  rows,
  credits,
  serverUsage,
  storage = 'sqlite · data/void.db',
  showReconciliation = false,
}: {
  rows: readonly Row[]
  credits: number
  serverUsage: number
  storage?: string
  showReconciliation?: boolean
}) => {
  const result = reconcile(rows, credits, serverUsage)
  return (
    <div className="flex h-full flex-col">
      <div className="border-border grid grid-cols-3 gap-4 border-b px-4 py-3 font-mono text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
            remaining · reconciled
          </span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={`${result.remaining}:${result.provisional}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="tabular-nums"
            >
              {n(result.remaining)}
              {result.provisional && (
                <span className="text-amber-600 dark:text-amber-400">
                  {' '}
                  · provisional
                </span>
              )}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
            remaining · server alone
          </span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={result.remoteRemaining}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="tabular-nums"
            >
              {n(result.remoteRemaining)}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
            credits · used
          </span>
          <span className="tabular-nums">
            {n(credits)} · {n(serverUsage)}
          </span>
        </div>
      </div>

      <div className="divide-border grid min-h-0 flex-1 grid-cols-2 divide-x">
        <Ledger
          title="local event storage"
          subtitle={storage}
          rows={rows.filter(inLocalStorage)}
          empty="nothing waiting"
        />
        <Ledger
          title="server · polar"
          subtitle="worker recomputes reducers"
          rows={rows.filter(onServer)}
          empty="nothing new counted yet"
        />
      </div>

      <AnimatePresence initial={false}>
        {showReconciliation && (
          <motion.div
            key="reconciliation"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="border-border mx-4 mb-4 grid grid-cols-4 gap-3 rounded-xl border p-3 font-mono text-[11px]"
          >
            {[
              ['applied', String(result.applied)],
              ['eventCount', n(result.eventCount)],
              ['remoteRemaining', n(result.remoteRemaining)],
              ['localAdjustment', n(result.localAdjustment)],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-[10px]">
                  {label}
                </span>
                <span className="tabular-nums">{value}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
