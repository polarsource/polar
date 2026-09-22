'use client'

import type { IrReducer } from '@void/sdk/config'
import { AnimatePresence, motion } from 'motion/react'
import { fold, project, type Folded, type StreamEvent } from './fold'

const EASE = [0.2, 0.8, 0.2, 1] as const

const format = (value: number | null) =>
  value === null
    ? 'null'
    : Number.isInteger(value)
      ? value.toLocaleString('en-US')
      : value.toLocaleString('en-US', { maximumFractionDigits: 2 })

const describe = (reducer: IrReducer) => {
  const agg = reducer.aggregation
  if (agg.func === 'derive') return agg.expression
  const where = (reducer.filter?.clauses ?? [])
    .filter((clause) => clause.property !== 'name')
    .map(
      (clause) =>
        `${clause.property} ${clause.operator} ${JSON.stringify(clause.value)}`,
    )
    .join(' and ')
  const call =
    'property' in agg && agg.property
      ? `${agg.func}(${agg.property})`
      : `${agg.func}()`
  const mapped = reducer.map ? ` after map` : ''
  return `${call}${mapped}${where ? ` where ${where}` : ''}`
}

/** What the newest event contributed to a reducer, for the row's right-hand note. */
const contribution = (
  reducer: IrReducer,
  folded: Folded,
  latest: StreamEvent | undefined,
  values: ReadonlyMap<string, number | null>,
) => {
  const agg = reducer.aggregation
  if (agg.func === 'derive') {
    const filled = agg.expression.replace(
      /\$([A-Za-z_][A-Za-z0-9_]*)/g,
      (_, name) => format(values.get(agg.inputs[name] ?? '') ?? null),
    )
    return { tone: 'in' as const, text: filled }
  }
  if (!latest) return null
  if (!folded.matched.includes(latest.id))
    return { tone: 'out' as const, text: 'filtered out' }
  if (agg.func === 'count') return { tone: 'in' as const, text: '+1' }
  const property = 'property' in agg ? agg.property : undefined
  if (property === undefined) return { tone: 'in' as const, text: 'kept' }
  const projected = project(reducer, latest.metadata)[property]
  const text = reducer.map
    ? `→ ${format(projected as number | null)}`
    : `+${format(projected as number | null)}`
  return { tone: 'in' as const, text }
}

/**
 * A stream of events on the left, the reducers on the right. Each event
 * arrives at the bottom of the stream; each reducer shows its running value
 * and what the newest event did to it, computed with the compiled reducers.
 */
export const ReducerStream = ({
  events,
  reducers,
}: {
  events: readonly StreamEvent[]
  reducers: readonly IrReducer[]
}) => {
  const folded = fold(reducers, events)
  const values = new Map(folded.map((f) => [f.slug, f.value]))
  const latest = events.at(-1)
  return (
    <div className="divide-border grid h-full grid-cols-[minmax(0,5fr)_minmax(0,6fr)] divide-x">
      <div className="flex min-h-0 flex-col">
        <div className="border-border text-muted-foreground flex items-baseline justify-between border-b px-4 py-2.5 font-mono text-[11px] tracking-wide uppercase">
          <span>events · acme</span>
          <span className="tabular-nums">{events.length}</span>
        </div>
        <ul className="flex flex-1 flex-col justify-end gap-1.5 overflow-hidden px-4 py-3">
          <AnimatePresence initial={false}>
            {events.map((event, i) => (
              <motion.li
                key={event.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: i === events.length - 1 ? 1 : 0.55, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className={`border-border flex items-baseline justify-between gap-3 rounded-lg border px-3 py-1.5 font-mono text-xs ${
                  i === events.length - 1 ? 'bg-muted' : ''
                }`}
              >
                <span>{event.name}</span>
                <span className="text-muted-foreground truncate">
                  {Object.entries(event.metadata)
                    .map(
                      ([k, v]) =>
                        `${k} ${typeof v === 'number' ? format(v) : String(v)}`,
                    )
                    .join(' · ')}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
      <div className="flex min-h-0 flex-col">
        <div className="border-border text-muted-foreground flex items-baseline justify-between border-b px-4 py-2.5 font-mono text-[11px] tracking-wide uppercase">
          <span>reducers</span>
          <span className="tabular-nums">{reducers.length}</span>
        </div>
        <ul className="divide-border flex flex-col divide-y overflow-auto px-4">
          <AnimatePresence initial={false}>
            {reducers.map((reducer, i) => {
              const row = folded[i]!
              const note = contribution(reducer, row, latest, values)
              return (
                <motion.li
                  key={reducer.slug}
                  layout
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="flex flex-col gap-0.5 py-2.5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[13px]">
                      {reducer.slug}
                    </span>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={format(row.value)}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.25, ease: EASE }}
                        className="font-mono text-[13px] tabular-nums"
                      >
                        {row.record
                          ? JSON.stringify(row.record)
                          : format(row.value)}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
                    <span className="text-muted-foreground truncate">
                      {describe(reducer)}
                    </span>
                    {note && (
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={`${latest?.id}:${note.text}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className={`shrink-0 rounded px-1.5 py-0.5 ${
                            note.tone === 'in'
                              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {note.text}
                        </motion.span>
                      </AnimatePresence>
                    )}
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
          {reducers.length === 0 && (
            <li className="text-muted-foreground py-3 font-mono text-xs">
              nothing folds these yet
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
