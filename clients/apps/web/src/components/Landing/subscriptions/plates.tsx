import type { ReactNode } from 'react'
import { line, Printout } from '../plates/Printout'
import { Stage } from '../plates/Stage'
import { E0, E2, E3, MIST, Sheet, SNOW, STOCK, T } from '../usage/kit'
import { Tag } from '../usage/plates'

/* ---------- half a year of one subscription: the head of the page ---------- */

/** January to July, a month to each column. */
const X0 = 420,
  X1 = 1720,
  MONTH = (X1 - X0) / 6
const at = (m: number) => X0 + m * MONTH
const STARTS = ['JAN 1', 'FEB 1', 'MAR 1', 'APR 1', 'MAY 1', 'JUN 1', 'JUL 1']
/** April 14, thirteen days into a thirty-day April. */
const UPGRADE = 3 + 13 / 30

/**
 * Half a year of one subscription as a timing diagram, in the hand of the proration plate below it: the plan as a
 * bar, Pro outlined until the upgrade and Team filled after, and under it a renewal at the start of every month,
 * the latest one tagged with what it charged.
 */
export function Cycle() {
  const plan = 460,
    bh = 56,
    renew = 720,
    fs = 24
  const xu = at(UPGRADE)
  return (
    <Stage label="One subscription from January to July: Pro until an upgrade to Team on April 14, renewed on the first of every month.">
      {/* the rows' names */}
      <T x={200} y={plan + bh / 2 + 8} size={fs} fill={MIST}>
        PLAN
      </T>
      <T x={200} y={renew + 8} size={fs} fill={MIST}>
        RENEWALS
      </T>

      {/* the plan */}
      <rect
        x={X0}
        y={plan}
        width={xu - X0}
        height={bh}
        fill="none"
        stroke={MIST}
        strokeWidth={2}
      />
      <rect x={xu} y={plan} width={X1 - xu} height={bh} fill={SNOW} />
      <T x={X0 + 24} y={plan + bh / 2 + 8} size={fs} fill={MIST}>
        PRO
      </T>
      <T x={xu + 24} y={plan + bh / 2 + 8} size={fs} fill="#0d0d0d">
        TEAM
      </T>

      {/* the upgrade */}
      <path
        d={`M${xu} ${plan - 50}V${renew + 60}`}
        stroke={E2}
        strokeWidth={2}
      />
      <rect x={xu - 9} y={plan - 59} width={18} height={18} fill={E2} />
      <T x={xu} y={plan - 84} size={fs} fill={SNOW} anchor="middle">
        APR 14
      </T>

      {/* the renewals: the checkout, one on each first of the month, the next one still to come */}
      <path d={`M${X0} ${renew}H${X1}`} stroke="#3a3a3a" strokeWidth={1.5} />
      {STARTS.map((t, k) => {
        const x = at(k)
        return (
          <g key={t}>
            {k === 0 ? (
              <circle
                cx={x}
                cy={renew}
                r={9}
                fill="#111111"
                stroke={SNOW}
                strokeWidth={2}
              />
            ) : k === STARTS.length - 1 ? (
              <rect
                x={x - 9}
                y={renew - 9}
                width={18}
                height={18}
                fill="#111111"
                stroke={MIST}
                strokeWidth={2}
                strokeDasharray="3 4"
              />
            ) : (
              <rect
                x={x - 9}
                y={renew - 9}
                width={18}
                height={18}
                fill={SNOW}
              />
            )}
            <T
              x={x}
              y={renew + 70}
              size={fs}
              fill={k === STARTS.length - 1 ? '#4a4a4a' : MIST}
              anchor="middle"
            >
              {t}
            </T>
          </g>
        )
      })}
      <path
        d={`M${at(5)} ${renew - 51}V${renew - 16}`}
        stroke={MIST}
        strokeWidth={1}
        strokeDasharray="2 5"
      />
      <Tag
        x={at(5)}
        y={renew - 100}
        t="RENEWED  $40.00"
        g={E0}
        ink={SNOW}
        fs={26}
        anchor="middle"
      />
    </Stage>
  )
}

/* ---------- the renewals, printed ---------- */

const C = 46
const MONTH_NAMES = 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split(' ')

/**
 * The same subscription's year as a register of orders, on the line printer's stationery: one line for every
 * renewal, each charged to the saved card, the plan changing to Team after the April upgrade.
 */
export function Renewals() {
  const rows = [
    line(['POLAR SOFTWARE, INC.'], ['ORDERS', C]),
    line(['SUBSCRIPTION  sub_01'], ['CUSTOMER  cus_4410', C]),
    '',
    line(['ORDER'], ['PERIOD', 20], ['PLAN', 30], ['AMOUNT', C]),
    line(['-----'], ['------', 20], ['----', 30], ['------', C]),
    ...MONTH_NAMES.map((m, k) =>
      line(
        [String(k + 1).padStart(4, '0')],
        [`${m} 1`, 20],
        [k < 4 ? 'Pro' : 'Team', 30],
        [k < 4 ? '$20.00' : '$40.00', C],
      ),
    ),
    line(['------', C]),
    line(['TOTAL'], ['$400.00', C]),
    '',
    '*** ALL PAID ***',
  ]
  return <Printout rows={rows} cols={C} w={900} title="The renewals, printed" />
}

/* ---------- a failed renewal, recovered ---------- */

/** The attempts on a failed renewal, by day: the charge, then the retries after 2, 5, 7 and 7 more days. */
const ATTEMPTS: [number, 'failed' | 'paid' | 'unused'][] = [
  [0, 'failed'],
  [2, 'failed'],
  [7, 'failed'],
  [14, 'paid'],
  [21, 'unused'],
]

const TAPE: [string, string, string, string][] = [
  ['00', 'charge', 'card_declined', 'past_due'],
  ['00', 'email', 'update payment link', 'past_due'],
  ['02', 'retry 1', 'insufficient_funds', 'past_due'],
  ['07', 'retry 2', 'card_declined', 'past_due'],
  ['14', 'retry 3', 'succeeded', 'active'],
]

/**
 * July's renewal, failed and recovered: the twenty-one days of the retry schedule as a line, an attempt on each
 * day it runs, and under it the tape of what happened, the subscription past due until the third retry pays.
 */
export function Recovery() {
  const s = STOCK.night
  const W = 1150,
    H = 900
  const x0 = 110,
    x1 = W - 110
  const xd = (d: number) => x0 + ((x1 - x0) * d) / 21
  const y = 300
  const ty = 560,
    lh = 50
  const cols = [x0, x0 + 110, x0 + 300, x1]
  const mark = (d: number, kind: string): ReactNode => {
    const x = xd(d)
    if (kind === 'failed')
      return (
        <path
          d={`M${x - 8} ${y - 8}l16 16m0 -16l-16 16`}
          stroke={s.ink}
          strokeWidth={2}
        />
      )
    if (kind === 'paid')
      return <rect x={x - 9} y={y - 9} width={18} height={18} fill={E2} />
    return (
      <circle
        cx={x}
        cy={y}
        r={7}
        fill={s.ground}
        stroke={s.dim}
        strokeWidth={1.4}
        strokeDasharray="2 3"
      />
    )
  }
  return (
    <Sheet s={s} w={W} h={H} plain>
      <T x={x0} y={120} size={20} fill={s.ink}>
        {'sub_01 · renewal Jul 1'}
      </T>
      <T x={x1} y={120} size={20} fill={E3} anchor="end">
        RECOVERED
      </T>
      {/* the schedule: past due from the failed charge to the retry that paid, active after */}
      <path
        d={`M${x0} ${y}H${xd(14)}`}
        stroke={E2}
        strokeWidth={2}
        strokeDasharray="6 6"
      />
      <path d={`M${xd(14)} ${y}H${xd(21)}`} stroke={s.ink} strokeWidth={2} />
      {ATTEMPTS.map(([d, kind]) => (
        <g key={d}>
          <T x={xd(d)} y={y - 50} size={16} fill={s.dim} anchor="middle">
            {`DAY ${d}`}
          </T>
          {mark(d, kind)}
        </g>
      ))}
      <T x={(x0 + xd(14)) / 2} y={y + 120} size={16} fill={E3} anchor="middle">
        PAST_DUE
      </T>
      <T
        x={(xd(14) + x1) / 2}
        y={y + 120}
        size={16}
        fill={s.dim}
        anchor="middle"
      >
        ACTIVE
      </T>
      {/* the tape */}
      {['DAY', 'ATTEMPT', 'RESULT', 'STATUS'].map((t, k) => (
        <T
          key={t}
          x={cols[k]}
          y={ty}
          size={16}
          fill={s.dim}
          anchor={k === 3 ? 'end' : 'start'}
        >
          {t}
        </T>
      ))}
      <path d={`M${x0} ${ty + 22}H${x1}`} stroke={s.rule} strokeWidth={1} />
      {TAPE.map((row, k) => {
        const last = k === TAPE.length - 1
        return (
          <g key={k}>
            {row.map((t, c) => (
              <T
                key={c}
                x={cols[c]}
                y={ty + 70 + k * lh}
                size={22}
                fill={c === 0 ? s.dim : last && c === 3 ? E3 : s.ink}
                anchor={c === 3 ? 'end' : 'start'}
              >
                {t}
              </T>
            ))}
          </g>
        )
      })}
    </Sheet>
  )
}
