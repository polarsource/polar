'use client'

import { useEffect, useState } from 'react'
import { E2, E3, MIST, polyline } from './kit'
import { Aggregation, STREAM } from './plates'

/** What each reading does. */
const READS: {
  fn: Aggregation
  name: string
  what: string
}[] = [
  {
    fn: 'count',
    name: 'Count',
    what: 'How many events matched. No property needed.',
  },
  {
    fn: 'sum',
    name: 'Sum',
    what: 'A property added up across every event.',
  },
  {
    fn: 'avg',
    name: 'Average',
    what: 'The mean of a property over the period.',
  },
  {
    fn: 'min',
    name: 'Minimum',
    what: 'The lowest value any event reported.',
  },
  {
    fn: 'max',
    name: 'Maximum',
    what: 'The peak value any event reported.',
  },
]

/** How long each reading holds before the next. */
const HOLD = 5000

/**
 * The five aggregations as a list beside one large reading. It steps through them on a timer, a hairline filling
 * along the current one; picking one shows it and starts the timer again from there.
 */
export function Aggregations() {
  const [active, setActive] = useState(0)
  // bumped on every pick, so picking the current one still restarts its timer
  const [run, setRun] = useState(0)
  useEffect(() => {
    // with reduced motion asked for, it holds where it is until picked
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setTimeout(
      () => setActive((k) => (k + 1) % READS.length),
      HOLD,
    )
    return () => window.clearTimeout(t)
  }, [active, run])
  const r = READS[active]
  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
      <style>{`@keyframes ub-hold { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>
      <ol className="flex flex-col lg:col-span-4">
        {READS.map((x, k) => {
          const on = k === active
          return (
            <li key={x.fn}>
              <button
                type="button"
                onClick={() => {
                  setActive(k)
                  setRun((n) => n + 1)
                }}
                aria-pressed={on}
                className={`dark:border-polar-800 relative flex w-full flex-col gap-2 border-t border-gray-200 py-5 text-left transition-colors ${on ? '' : 'dark:text-polar-500 text-gray-500 hover:text-current'}`}
              >
                {on ? (
                  <span
                    key={`${active}-${run}`}
                    aria-hidden
                    className="absolute inset-x-0 -top-px h-px origin-left bg-[#6b79ea] motion-reduce:hidden"
                    style={{ animation: `ub-hold ${HOLD}ms linear forwards` }}
                  />
                ) : null}
                <span className="flex items-baseline gap-4">
                  <span className="dark:text-polar-500 w-6 shrink-0 text-sm text-gray-500 tabular-nums">
                    {String(k + 1).padStart(2, '0')}
                  </span>
                  <span className="text-lg">{x.name}</span>
                </span>
                {on ? (
                  <span className="flex flex-col gap-2 pl-10">
                    <span className="dark:text-polar-400 text-base text-gray-600">
                      {x.what}
                    </span>
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>
      <div className="lg:col-span-8 lg:self-center">
        <Reading fn={r.fn} />
      </div>
    </div>
  )
}

const FORMULA: Record<Aggregation, string> = {
  count: 'count()',
  sum: 'sum(metadata.tokens)',
  avg: 'avg(metadata.tokens)',
  min: 'min(metadata.tokens)',
  max: 'max(metadata.tokens)',
}

/**
 * One reading of the stream. The marks are SVG and scale with the column; the type is HTML, so it stays the
 * page's own size at any width.
 */
function Reading({ fn }: { fn: Aggregation }) {
  const W = 1000,
    H = 320,
    x0 = 12,
    x1 = W - 12,
    base = H - 2,
    top = 14
  const toks = STREAM.map((e) => e.tokens)
  const max = Math.max(...toks),
    min = Math.min(...toks)
  const total = toks.reduce((a, t) => a + t, 0)
  const mean = total / toks.length
  const step = (x1 - x0) / (toks.length - 1)
  const xOf = (k: number) => x0 + k * step
  const yOf = (t: number) => base - ((base - top) * t) / max
  const lit = (t: number) =>
    fn === 'count' || (fn === 'min' && t === min) || (fn === 'max' && t === max)
  const stair: [number, number][] = []
  if (fn === 'sum') {
    let run = 0
    stair.push([x0 - step / 2, base])
    toks.forEach((t, k) => {
      stair.push([xOf(k) - step / 2, base - ((base - top) * run) / total])
      run += t
      stair.push([xOf(k) - step / 2, base - ((base - top) * run) / total])
    })
    stair.push([x1 + step / 2, top])
  }
  const line =
    fn === 'avg' ? mean : fn === 'min' ? min : fn === 'max' ? max : null
  const value = {
    count: toks.length,
    sum: total,
    avg: mean,
    min,
    max,
  }[fn]
  const hair = { vectorEffect: 'non-scaling-stroke' as const }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-6">
        <span className="dark:text-polar-400 font-mono text-sm text-gray-600">
          {FORMULA[fn]}
        </span>
        <span className="font-display text-4xl tracking-tight tabular-nums md:text-5xl">
          {Math.round(value).toLocaleString('en-US')}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full overflow-visible"
          aria-hidden
        >
          {toks.map((t, k) => {
            const on = lit(t)
            return (
              <g key={k}>
                <path
                  d={`M${xOf(k)} ${base}V${yOf(t)}`}
                  stroke={on ? E2 : MIST}
                  strokeWidth={on ? 2 : 1}
                  style={hair}
                />
                <rect
                  x={xOf(k) - 5}
                  y={yOf(t) - 5}
                  width={10}
                  height={10}
                  fill={on ? E2 : MIST}
                />
              </g>
            )
          })}
          {fn === 'sum' ? (
            <path
              d={polyline(stair)}
              fill="none"
              stroke={E2}
              strokeWidth={2}
              style={hair}
            />
          ) : null}
          {line !== null ? (
            <path
              d={`M0 ${yOf(line)}H${W}`}
              stroke={fn === 'avg' ? E2 : E3}
              strokeWidth={1.5}
              strokeDasharray="3 5"
              style={hair}
            />
          ) : null}
          <path
            d={`M0 ${base}H${W}`}
            stroke={MIST}
            strokeWidth={1}
            style={hair}
          />
        </svg>
        {/* the events, numbered under their stems */}
        <div className="dark:text-polar-500 relative h-4 text-xs text-gray-500 tabular-nums">
          {toks.map((_, k) => (
            <span
              key={k}
              className="absolute -translate-x-1/2"
              style={{ left: `${(xOf(k) / W) * 100}%` }}
            >
              {k + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
