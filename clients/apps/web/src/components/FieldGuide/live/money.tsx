import { MONO } from '../sheet'
import { LINE, MID, DIM, BG, HAIR, term, type TermTok } from '../kit'
import { money, num, usd, useSim, type SimEvent } from '../simulation'

const day = (at: number) => new Date(at).toISOString().slice(5, 10)
const T = (t: string, w?: number): TermTok => ({ t, tone: 'dim', w })

/** The credit balance page, running: the latest grant, the last four draws on it, the balance off the last line. */
export function LiveBalance({
  X0,
  BX,
  BW,
}: {
  X0: number
  BX: number
  BW: number
}) {
  const sim = useSim((s) => s)
  const { line, gutter, bar, dot, LH } = term(X0, 150)
  const draws = sim.events.filter((e) => e.name === 'tokens.out').slice(-4)
  const grant = [...sim.events]
    .reverse()
    .find((e) => e.name === 'credit.granted')
  const grantAt = grant?.at ?? draws[0]?.at ?? 0
  const after = draws.reduceRight<number[]>((acc, e, i) => {
    acc[i] =
      i === draws.length - 1 ? sim.credits : acc[i + 1] + draws[i + 1].quantity
    return acc
  }, new Array(draws.length).fill(0))
  const row = (r: number, e: SimEvent, bal: number, last: boolean) => (
    <g key={e.id}>
      {line(
        r,
        0,
        [
          T(day(e.at), 7),
          {
            t: `${e.name.padEnd(12)}${num(e.quantity).padStart(6)} × 1`,
            w: 24,
          },
          { t: `-${num(e.quantity)}`, w: 9, tone: 'dim' },
          { t: num(bal), tone: last ? 'inv' : 'ink', w: 7 },
        ],
        `r${e.id}`,
      )}
      <rect
        x={BX}
        y={150 + r * LH - 5}
        width={(BW * bal) / sim.grant}
        height={3}
        fill={last ? LINE : MID}
      />
    </g>
  )
  return (
    <g data-live>
      {gutter(2)}
      {line(
        2,
        0,
        [
          T(day(grantAt), 7),
          { t: 'credit.granted', w: 24 },
          { t: `+${num(sim.grant)}`, w: 9 },
          { t: num(sim.grant), w: 7 },
        ],
        'grant',
      )}
      <rect x={BX} y={150 + 2 * LH - 5} width={BW} height={3} fill={MID} />
      {dot(4, 24)}
      {dot(4, 27)}
      {draws.map((e, i) => row(6 + i * 2, e, after[i], i === draws.length - 1))}
      {draws.length > 1 ? bar(6, 6 + (draws.length - 1) * 2, -2) : null}
      {line(
        15,
        0,
        [
          T('period', 7),
          { t: 'balance.carried', w: 24, tone: 'dim' },
          T('', 9),
          { t: num(sim.credits), tone: 'dim', w: 7 },
          T(`  of ${num(sim.grant)}`),
        ],
        'c',
      )}
    </g>
  )
}

/** The invoice page, running: each line a meter read so far, credits off before the sum. */
export function LiveInvoice({
  x,
  y,
  w,
  rows,
}: {
  x: number
  y: number
  w: number
  rows: number[]
}) {
  const sim = useSim((s) => s)
  const meters = ['tokens.out', 'tokens.in', 'image.gen'] as const
  const lines = meters.map((m) => ({
    m,
    q: sim.usage[m],
    a: usd(sim, m, sim.usage[m]),
  }))
  const sum =
    lines.reduce((t, l) => t + l.a, 0) +
    usd(sim, 'api.call', sim.usage['api.call'])
  const credit = Math.min(sum, usd(sim, 'tokens.out', sim.consumed))
  const total = sum - credit
  const text = (
    tx: number,
    ty: number,
    t: string,
    fill = DIM,
    anchor: 'start' | 'end' = 'start',
  ) => (
    <text
      x={tx}
      y={ty}
      fontSize={6.5}
      fill={fill}
      textAnchor={anchor}
      style={{ ...MONO, letterSpacing: 0 }}
    >
      {t}
    </text>
  )
  return (
    <g data-live>
      {lines.map((l, i) => (
        <g key={l.m}>
          <rect
            x={x + 12}
            y={rows[i] - 6}
            width={w - 24}
            height={10}
            fill={BG}
          />
          {text(x + 12, rows[i] + 2, l.m)}
          {text(x + 74, rows[i] + 2, num(l.q))}
          {text(x + w - 12, rows[i] + 2, money(l.a), DIM, 'end')}
        </g>
      ))}
      <rect x={x + w - 60} y={y + 124} width={48} height={10} fill={BG} />
      {text(x + w - 12, y + 132, `-${money(credit)}`, LINE, 'end')}
      <rect
        x={x + w - 70}
        y={y + 162}
        width={58}
        height={14}
        fill={BG}
        stroke={LINE}
        strokeWidth={HAIR}
      />
      {text(x + w - 16, y + 172, money(total), LINE, 'end')}
    </g>
  )
}
