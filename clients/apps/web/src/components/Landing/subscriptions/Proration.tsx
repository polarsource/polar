'use client'

import { useEffect, useState } from 'react'
import { E0, E2, MIST, NIGHT, SNOW, T } from '../usage/kit'
import { Tag } from '../usage/plates'

type Behavior = 'invoice' | 'prorate' | 'next_period'

const BEHAVIORS: { key: Behavior; name: string; what: string }[] = [
  {
    key: 'invoice',
    name: 'Invoice immediately',
    what: 'The plan changes now, and the difference is invoiced and charged in the same call.',
  },
  {
    key: 'prorate',
    name: 'Apply on next invoice',
    what: 'The plan changes now, and the difference rides along on the next renewal. The default.',
  },
  {
    key: 'next_period',
    name: 'Apply on next period',
    what: 'The change waits for the next period to start, with nothing prorated. Safer for downgrades.',
  },
]

/** How long each behavior holds before the next. */
const HOLD = 5000

/**
 * The three proration behaviors as a list beside one drawing of the change. It steps through them on a timer, a
 * hairline filling along the current one; picking one shows it and starts the timer again from there.
 */
export function Proration() {
  const [active, setActive] = useState(0)
  // bumped on every pick, so picking the current one still restarts its timer
  const [run, setRun] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setTimeout(
      () => setActive((k) => (k + 1) % BEHAVIORS.length),
      HOLD,
    )
    return () => window.clearTimeout(t)
  }, [active, run])
  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
      <style>{`@keyframes sub-hold { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>
      <ol className="flex flex-col lg:col-span-4">
        {BEHAVIORS.map((x, k) => {
          const on = k === active
          return (
            <li key={x.key}>
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
                    style={{ animation: `sub-hold ${HOLD}ms linear forwards` }}
                  />
                ) : null}
                <span className="flex items-baseline gap-4">
                  <span className="dark:text-polar-500 w-6 shrink-0 text-sm text-gray-500 tabular-nums">
                    {String(k + 1).padStart(2, '0')}
                  </span>
                  <span className="text-lg">{x.name}</span>
                </span>
                {on ? (
                  <span className="dark:text-polar-400 pl-10 text-base text-gray-600">
                    {x.what}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>
      <div className="lg:col-span-8 lg:self-center">
        <Change behavior={BEHAVIORS[active].key} />
      </div>
    </div>
  )
}

/**
 * One upgrade, from Pro to Team on April 14, drawn for a behavior: the plan through the period and into the next,
 * and where the prorated difference is charged, if anywhere.
 */
function Change({ behavior }: { behavior: Behavior }) {
  const W = 1000,
    H = 380
  const x0 = 120,
    xEnd = 820,
    x1 = 960
  // April 14 is thirteen days into a thirty-day April
  const xc = x0 + ((xEnd - x0) * 13) / 30
  const switchAt = behavior === 'next_period' ? xEnd : xc
  const plan = 110,
    bh = 34,
    charge = 250
  const fs = 18
  const chip = {
    invoice: { x: xc, t: 'INVOICED NOW  +$11.34' },
    prorate: { x: xEnd, t: '+$11.34 ON MAY 1' },
    next_period: { x: xEnd, t: 'NOTHING PRORATED' },
  }[behavior]
  return (
    <figure className="dark:bg-polar-900 w-full overflow-hidden rounded-md bg-[#111111]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        aria-label={`An upgrade from Pro to Team on April 14: ${chip.t.toLowerCase()}.`}
      >
        {/* the rows' names */}
        <T x={40} y={plan + bh / 2 + 6} size={16} fill={MIST}>
          PLAN
        </T>
        <T x={40} y={charge + 6} size={16} fill={MIST}>
          CHARGE
        </T>
        {/* the plan: Pro until the switch, Team after; the next period lies past the renewal */}
        <rect
          x={x0}
          y={plan}
          width={switchAt - x0}
          height={bh}
          fill="none"
          stroke={MIST}
          strokeWidth={1.4}
        />
        <rect
          x={switchAt}
          y={plan}
          width={x1 - switchAt}
          height={bh}
          fill={SNOW}
        />
        <T x={x0 + 16} y={plan + bh / 2 + 6} size={16} fill={MIST}>
          PRO
        </T>
        <T x={switchAt + 16} y={plan + bh / 2 + 6} size={16} fill={NIGHT}>
          TEAM
        </T>
        {/* the renewal, and the day of the change */}
        <path
          d={`M${xEnd} ${plan - 30}V${H - 70}`}
          stroke={MIST}
          strokeWidth={1}
          strokeDasharray="2 5"
        />
        <path
          d={`M${xc} ${plan - 30}V${H - 70}`}
          stroke={E2}
          strokeWidth={1.4}
        />
        <rect x={xc - 6} y={plan - 36} width={12} height={12} fill={E2} />
        {/* where the difference is charged */}
        <path d={`M${x0} ${charge}H${x1}`} stroke="#3a3a3a" strokeWidth={1} />
        <rect
          x={chip.x - 7}
          y={charge - 7}
          width={14}
          height={14}
          fill={behavior === 'next_period' ? NIGHT : SNOW}
          stroke={SNOW}
          strokeWidth={1.4}
        />
        <Tag
          x={Math.min(chip.x, x1 - chip.t.length * fs * 0.3 - fs)}
          y={charge + 22}
          t={chip.t}
          g={
            behavior === 'next_period'
              ? MIST
              : behavior === 'invoice'
                ? E0
                : SNOW
          }
          ink={behavior === 'invoice' ? SNOW : NIGHT}
          fs={fs}
          anchor="middle"
        />
        {/* the dates */}
        {(
          [
            [x0, 'APR 1'],
            [xc, 'APR 14'],
            [xEnd, 'MAY 1'],
          ] as const
        ).map(([x, t]) => (
          <T
            key={t}
            x={x}
            y={plan - 50}
            size={16}
            fill={x === xc ? SNOW : MIST}
            anchor="middle"
          >
            {t}
          </T>
        ))}
      </svg>
    </figure>
  )
}
