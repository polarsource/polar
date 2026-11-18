import { line, Printout } from '../plates/Printout'
import { Stage } from '../plates/Stage'
import {
  CW,
  E0,
  E2,
  E3,
  MIST,
  NIGHT,
  rand,
  Sheet,
  SNOW,
  STOCK,
  T,
} from '../usage/kit'
import { Tag } from '../usage/plates'

/* ---------- sales folding into one merchant: the head of the page ---------- */

/** Sales in seven countries, each with the tax it carries: [label, ground, ink]. */
const SALES: [string, string, string][] = [
  ['DE  VAT 19%', SNOW, NIGHT],
  ['FR  VAT 20%', MIST, NIGHT],
  ['IT  VAT 22%', SNOW, NIGHT],
  ['SE  VAT 25%', E0, SNOW],
  ['ES  VAT 21%', MIST, NIGHT],
  ['GB  VAT 20%', SNOW, NIGHT],
  ['US-NY  8.875%', MIST, NIGHT],
]

/** Where the tax goes: the authorities Polar files with. */
const AUTHORITIES = ['EU OSS · IRELAND', 'HMRC · UK', 'NEW YORK STATE']

/**
 * Sales from seven countries run in from the left, several strands each, and fold into one node: Polar, the
 * merchant on every one of them. Out of it the money splits: the tax fans up to the authorities it is filed
 * with, and what is left runs on, one heavy line, to the payout.
 */
export function Routes() {
  const r = rand('routes')
  const fs = 22,
    th = fs * 1.9
  const tagW = (t: string) => t.length * fs * CW + fs * 1.3
  const node = { x: 760, y: 560 }
  const split = 980
  const tax = { x: 1380, y: 300 },
    payout = { x: 1380, y: 800 }
  const strands: string[] = []
  const quiet: string[] = []
  SALES.forEach(([t], k) => {
    const y = 170 + k * 130
    const x = 120 + tagW(t) + 12
    for (let i = 0; i < 6; i++) {
      const o = (i - 2.5) * 5 + (r() - 0.5) * 2
      const d = `M${x} ${(y + o).toFixed(1)}C${x + 260} ${(y + o).toFixed(1)} ${node.x - 240} ${(node.y + o * 0.3).toFixed(1)} ${node.x - 9} ${node.y}`
      ;(i % 3 === 2 ? quiet : strands).push(d)
    }
  })
  // the tax, up and out to each authority's tag
  const fan = AUTHORITIES.map((_, k) => {
    const y = tax.y - 110 + k * 110
    return `M${split} ${node.y}C${split + 160} ${node.y} ${tax.x - 240} ${y} ${tax.x - 14} ${y}`
  })
  return (
    <Stage label="Sales from seven countries fold into Polar, the merchant of record; the tax is filed with each authority and the rest is paid out to you.">
      <path d={quiet.join('')} fill="none" stroke={MIST} strokeWidth={0.8} />
      <path d={strands.join('')} fill="none" stroke={SNOW} strokeWidth={0.9} />
      {SALES.map(([t, g, ink], k) => (
        <Tag
          key={t}
          x={120}
          y={170 + k * 130 - th / 2}
          t={t}
          g={g}
          ink={ink}
          fs={fs}
        />
      ))}

      {/* the merchant */}
      <path
        d={`M${node.x + 9} ${node.y}H${split}`}
        stroke={SNOW}
        strokeWidth={2.4}
      />
      <rect
        x={node.x - 9}
        y={node.y - 9}
        width={18}
        height={18}
        fill={NIGHT}
        stroke={SNOW}
        strokeWidth={1.6}
      />
      <path
        d={`M${node.x} ${node.y - 34}V${node.y - 150}`}
        stroke={MIST}
        strokeWidth={0.8}
        strokeDasharray="2 4"
      />
      <T x={node.x} y={node.y - 166} size={18} fill={MIST} anchor="middle">
        merchant of record
      </T>
      <Tag
        x={node.x}
        y={node.y + 40}
        t="POLAR"
        g={SNOW}
        ink={NIGHT}
        fs={26}
        anchor="middle"
      />

      {/* the tax, filed and remitted */}
      <path
        d={fan.join('')}
        fill="none"
        stroke={MIST}
        strokeWidth={1.2}
        strokeDasharray="6 6"
      />
      {AUTHORITIES.map((t, k) => (
        <Tag
          key={t}
          x={tax.x}
          y={tax.y - 110 + k * 110 - th / 2}
          t={t}
          g="#2a2a2a"
          ink={SNOW}
          fs={fs}
        />
      ))}
      <T x={tax.x} y={tax.y - 200} size={18} fill={MIST}>
        tax, filed and remitted
      </T>

      {/* the rest, paid out */}
      <path
        d={`M${split} ${node.y}C${split + 160} ${node.y} ${payout.x - 240} ${payout.y} ${payout.x - 14} ${payout.y}`}
        fill="none"
        stroke={SNOW}
        strokeWidth={2.4}
      />
      <rect x={split - 6} y={node.y - 6} width={12} height={12} fill={E2} />
      <Tag
        x={payout.x}
        y={payout.y - 26 * 0.95}
        t="PAYOUT TO YOU"
        g={E0}
        ink={SNOW}
        fs={26}
      />
      <T x={payout.x} y={payout.y + 70} size={18} fill={MIST}>
        net of tax, one transfer
      </T>
    </Stage>
  )
}

/* ---------- a receipt, printed ---------- */

const C = 40
const R = C - 3

/** The rows the notes beside the receipt point at. */
const RECEIPT_MARKS = { 0: 1, 2: 2, 10: 3, 15: 4 }

/**
 * A customer's receipt, as the line printer gives it: Polar named as the seller, the product sold on your behalf,
 * the VAT at the customer's rate, and the registration it is filed under.
 */
export function Receipt() {
  const rows = [
    'POLAR SOFTWARE, INC.',
    'MERCHANT OF RECORD',
    'SOLD ON BEHALF OF ACME AI',
    '',
    line(['RECEIPT'], ['#2211-0042', R]),
    line(['DATE'], ['2026-11-18', R]),
    line(['BILL TO'], ['L. FISCHER', R]),
    line(['BERLIN, DE', R]),
    '',
    line(['Acme Pro, monthly'], ['$20.00', R]),
    line(['VAT 19% (DE)'], ['$3.80', R]),
    line(['------', R]),
    line(['TOTAL'], ['$23.80', R]),
    '',
    line(['PAID'], ['VISA **** 4242', R]),
    line(['VAT'], ['EU OSS, IRELAND', R]),
    '',
    '*** THANK YOU ***',
  ]
  return (
    <Printout
      rows={rows}
      cols={C}
      w={820}
      marks={RECEIPT_MARKS}
      title="A receipt, printed"
    />
  )
}

/* ---------- the filings ---------- */

const FILINGS: [string, string, string, string][] = [
  ['EU OSS · IRELAND', 'Q3 2026', '18,402.17', 'FILED'],
  ['HMRC · UK', 'Q3 2026', '6,118.40', 'FILED'],
  ['NEW YORK STATE', 'Q3 2026', '2,207.95', 'FILED'],
  ['EU OSS · IRELAND', 'Q2 2026', '16,930.62', 'PAID'],
  ['HMRC · UK', 'Q2 2026', '5,874.11', 'PAID'],
  ['NEW YORK STATE', 'Q2 2026', '1,996.30', 'PAID'],
]

/**
 * The quarter's filings, on Night: what was collected and remitted, as one bar that is the same at both ends,
 * and under it the tape of returns, each filed under Polar's registration, with the liability left to you at nil.
 */
export function Filings() {
  const s = STOCK.night
  const W = 1150,
    H = 900
  const x0 = 110,
    x1 = W - 110
  const by = 280,
    bh = 14
  const ty = 440,
    lh = 50
  const cols = [x0, x0 + 360, x0 + 700, x1]
  return (
    <Sheet s={s} w={W} h={H} plain>
      <T x={x0} y={120} size={20} fill={s.ink}>
        {'acme_ai · tax · Q3 2026'}
      </T>
      <T x={x1} y={120} size={20} fill={E3} anchor="end">
        YOUR LIABILITY $0.00
      </T>
      {/* collected, and all of it remitted */}
      <T x={x0} y={by - 30} size={18} fill={s.ink}>
        COLLECTED 26,728.52
      </T>
      <T x={x1} y={by - 30} size={18} fill={s.dim} anchor="end">
        REMITTED 26,728.52
      </T>
      <rect x={x0} y={by} width={x1 - x0} height={bh} fill={s.ink} />
      <path
        d={`M${x1} ${by - 14}V${by + bh + 14}`}
        stroke={E2}
        strokeWidth={2}
      />
      {/* the tape */}
      {['AUTHORITY', 'PERIOD', 'TAX', 'STATUS'].map((t, k) => (
        <T
          key={t}
          x={cols[k]}
          y={ty}
          size={16}
          fill={s.dim}
          anchor={k >= 2 ? 'end' : 'start'}
        >
          {t}
        </T>
      ))}
      <path d={`M${x0} ${ty + 22}H${x1}`} stroke={s.rule} strokeWidth={1} />
      {FILINGS.map((row, k) => {
        const y = ty + 70 + k * lh
        return (
          <g key={k} opacity={k < 3 ? 1 : 0.6}>
            {k === 0 ? (
              <rect x={x0 - 30} y={y - 15} width={12} height={12} fill={E2} />
            ) : null}
            {row.map((t, c) => (
              <T
                key={c}
                x={cols[c]}
                y={y}
                size={22}
                fill={c === 1 ? s.dim : c === 3 && k < 3 ? E3 : s.ink}
                anchor={c >= 2 ? 'end' : 'start'}
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
