'use client'

import { AnimatePresence, motion } from 'motion/react'

const EASE = [0.2, 0.8, 0.2, 1] as const

/** A moment on a lane, in percent of its width. */
export interface Call {
  readonly at: number
  readonly label: string
  /** Which identity the call landed on; null means it had none and failed. */
  readonly lands: string | null
}

export interface Span {
  readonly id: string
  readonly identity: string
  readonly tags?: Record<string, string>
  readonly start: number
  readonly end: number
  readonly nested?: readonly Span[]
}

export interface Lane {
  readonly id: string
  readonly label: string
  readonly spans: readonly Span[]
  readonly calls: readonly Call[]
}

/** A header carried from one lane to another, drawn as an arrow between them. */
export interface Crossing {
  readonly from: string
  readonly to: string
  readonly at: number
  readonly header: string
}

const SpanBox = ({ span, depth }: { span: Span; depth: number }) => (
  <motion.div
    layout
    initial={{ opacity: 0, scaleX: 0.9 }}
    animate={{ opacity: 1, scaleX: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3, ease: EASE }}
    className={`absolute flex flex-col rounded-lg border ${
      depth === 0
        ? 'border-foreground/60 bg-foreground/[0.04]'
        : 'border-foreground/40 bg-foreground/[0.06]'
    }`}
    style={{
      left: `${span.start}%`,
      width: `${span.end - span.start}%`,
      top: 6 + depth * 26,
      bottom: 32,
      transformOrigin: 'left',
    }}
  >
    <div className="flex items-baseline gap-2 px-2 pt-1 font-mono text-[11px]">
      <span>run as {span.identity}</span>
      {span.tags &&
        Object.entries(span.tags).map(([k, v]) => (
          <span
            key={k}
            className="bg-muted text-muted-foreground rounded px-1 text-[10px]"
          >
            {k}: {v}
          </span>
        ))}
    </div>
    {span.nested?.map((inner) => (
      <SpanBox key={inner.id} span={inner} depth={depth + 1} />
    ))}
  </motion.div>
)

/**
 * Lanes of time. A span is a `run`: everything called inside it lands on
 * that identity. Nested spans push and pop; parallel lanes never see each
 * other; a header can carry the identity from one lane to the next.
 */
export const AmbientSpan = ({
  lanes,
  crossing,
}: {
  lanes: readonly Lane[]
  crossing?: Crossing
}) => (
  <div className="flex h-full flex-col">
    <div className="border-border text-muted-foreground flex items-baseline justify-between border-b px-4 py-2.5 font-mono text-[11px] tracking-wide uppercase">
      <span>ambient identity</span>
      <span>time →</span>
    </div>
    <div className="relative flex flex-1 flex-col gap-3 overflow-hidden px-4 py-4">
      <AnimatePresence initial={false}>
        {lanes.map((lane) => {
          const depth = Math.max(
            0,
            ...lane.spans.map((s) => (s.nested?.length ? 2 : 1)),
          )
          return (
            <motion.div
              key={lane.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex flex-col gap-1"
            >
              <span className="text-muted-foreground font-mono text-[11px]">
                {lane.label}
              </span>
              <div
                className="bg-muted/60 relative rounded-lg"
                style={{ height: 40 + depth * 26 + 30 }}
              >
                <AnimatePresence initial={false}>
                  {lane.spans.map((span) => (
                    <SpanBox key={span.id} span={span} depth={0} />
                  ))}
                </AnimatePresence>
                {lane.calls.map((call) => (
                  <motion.div
                    key={`${call.at}:${call.label}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE, delay: 0.2 }}
                    className="absolute bottom-1 flex -translate-x-1/2 flex-col items-center gap-0.5"
                    style={{ left: `${call.at}%` }}
                  >
                    <span
                      className={`size-2 rounded-full ${call.lands ? 'bg-foreground' : 'bg-red-500'}`}
                    />
                    <span
                      className={`font-mono text-[10px] whitespace-nowrap ${
                        call.lands
                          ? 'text-muted-foreground'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {call.label}
                      {call.lands ? ` → ${call.lands}` : ''}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {crossing && (
          <motion.div
            key="crossing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-none absolute inset-x-4 top-4 bottom-4"
          >
            <div
              className="absolute flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${crossing.at}%`, top: 66, height: 70 }}
            >
              <span className="border-foreground/50 h-full border-l border-dashed" />
              <span className="text-foreground/60 -mt-1 text-[10px]">▼</span>
            </div>
            <span
              className="bg-card border-border absolute -translate-x-1/2 rounded border px-1.5 py-0.5 font-mono text-[10px]"
              style={{ left: `${crossing.at}%`, top: 92 }}
            >
              {crossing.header}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
)
