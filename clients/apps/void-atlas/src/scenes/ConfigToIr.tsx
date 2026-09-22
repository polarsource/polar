'use client'

import type { Ir, IrReducer } from '@void/sdk/config'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'

const EASE = [0.2, 0.8, 0.2, 1] as const

const describeReducer = (reducer: IrReducer) => {
  const where = reducer.filter?.clauses
    .filter((clause) => clause.property !== 'name')
    .map((clause) => `${clause.property} ${clause.operator} ${clause.value}`)
    .join(', ')
  const event = reducer.filter?.clauses.find((c) => c.property === 'name')
  const agg = reducer.aggregation
  const fn =
    agg.func === 'derive'
      ? agg.expression
      : 'property' in agg && agg.property
        ? `${agg.func}(${agg.property})`
        : `${agg.func}()`
  return `${fn} over ${event?.value ?? '?'}${where ? ` where ${where}` : ''}`
}

const Row = ({ slug, detail }: { slug: string; detail: string }) => (
  <motion.li
    layout
    initial={{ opacity: 0, x: 12 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 12 }}
    transition={{ duration: 0.35, ease: EASE }}
    className="flex items-baseline justify-between gap-4 py-1.5"
  >
    <span className="font-mono text-[13px]">{slug}</span>
    <span className="text-muted-foreground truncate text-right font-mono text-xs">
      {detail}
    </span>
  </motion.li>
)

const Section = ({
  name,
  children,
  count,
}: {
  name: string
  count: number
  children: React.ReactNode
}) => (
  <motion.section layout className="flex flex-col gap-1">
    <div className="text-muted-foreground flex items-baseline justify-between font-mono text-[11px] tracking-wide uppercase">
      <span>{name}</span>
      <span className="tabular-nums">{count}</span>
    </div>
    <ul className="divide-border flex flex-col divide-y">
      <AnimatePresence initial={false}>{children}</AnimatePresence>
      {count === 0 && (
        <li className="text-muted-foreground py-1.5 font-mono text-xs opacity-60">
          none yet
        </li>
      )}
    </ul>
  </motion.section>
)

/**
 * The compiled form of the lesson's config, as `void deploy` would send it.
 * Rows appear as the file gains definitions; the checksum shows once the
 * module is a config and changes whenever the compiled form does.
 */
export const ConfigToIr = ({
  ir,
  checksum,
}: {
  ir: Ir
  checksum: string | null
}) => (
  <div className="flex h-full flex-col">
    <div className="border-border flex items-center justify-between border-b px-4 py-2.5">
      <span className="text-muted-foreground font-mono text-xs">
        compile(config)
      </span>
      <span className="text-muted-foreground font-mono text-xs">
        version {ir.version}
      </span>
    </div>
    <LayoutGroup>
      <div className="flex flex-1 flex-col gap-5 overflow-auto px-4 py-4">
        <Section name="events" count={ir.events.length}>
          {ir.events.map((event) => (
            <Row key={event.name} slug={event.name} detail="name only" />
          ))}
        </Section>
        <Section name="reducers" count={ir.reducers.length}>
          {ir.reducers.map((reducer) => (
            <Row
              key={reducer.slug}
              slug={reducer.slug}
              detail={describeReducer(reducer)}
            />
          ))}
        </Section>
        <Section name="meters" count={ir.meters.length}>
          {ir.meters.map((meter) => (
            <Row
              key={meter.slug}
              slug={meter.slug}
              detail={`${meter.reducer} × ${meter.unit_amount} ${meter.currency}`}
            />
          ))}
        </Section>
      </div>
      <motion.div
        layout
        className="border-border flex items-center justify-between border-t px-4 py-2.5"
      >
        <span className="text-muted-foreground font-mono text-xs">sha256</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={checksum ?? 'none'}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: EASE }}
            className={`font-mono text-xs ${checksum ? '' : 'text-muted-foreground'}`}
          >
            {checksum
              ? `${checksum.slice(0, 12)}…${checksum.slice(-6)}`
              : 'not a config yet'}
          </motion.span>
        </AnimatePresence>
      </motion.div>
    </LayoutGroup>
  </div>
)
