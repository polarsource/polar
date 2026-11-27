import type { CSSProperties, ReactNode } from 'react'
import {
  body,
  chevron,
  CW,
  DumpText,
  dumpW,
  E0,
  E2,
  E3,
  NIGHT,
  KINDS,
  placer,
  polyline,
  rand,
  rowsOf,
  Sheet,
  STOCK,
  type Stock,
  T,
} from './kit'

/* ---------- a meter, as a watershed: the head of the page ---------- */

/** A name set reversed on a block, as the springs and the steps are. */
function Tag({
  x,
  y,
  t,
  g,
  ink,
  fs,
  anchor = 'start',
}: {
  x: number
  y: number
  t: string
  g: string
  ink: string
  fs: number
  anchor?: 'start' | 'middle'
}) {
  const padX = fs * 0.65,
    bh = fs * 1.9,
    w = t.length * fs * CW + padX * 2
  const left = anchor === 'middle' ? x - w / 2 : x
  return (
    <g>
      <rect x={left} y={y} width={w} height={bh} fill={g} />
      <T x={left + padX} y={y + bh / 2 + fs * 0.36} size={fs} fill={ink}>
        {t}
      </T>
    </g>
  )
}

/**
 * After A meter, as a watershed, turned on its side for the head of the page, on deep Ether: four kinds of event
 * spring up at the left, and their lines run across the sheet like water over ground that slopes to one fold.
 * There the reducer takes them all, and one line leaves it, stepping through the meter and the price to the
 * line on the invoice.
 */
export function Watershed({
  cover = false,
  stock = 'ether',
}: {
  cover?: boolean
  /** The sheet it is drawn on: Ether, as the usage billing page had it, or Night for the dark site. */
  stock?: 'ether' | 'night'
}) {
  const s = STOCK[stock]
  const W = 1600,
    H = 860
  const r = rand('watershed')
  const cy = 430,
    left = 330,
    outX = 760
  const fs = 20,
    chipW = (t: string) => t.length * fs * CW + fs * 1.3,
    chipH = fs * 1.9
  // the springs, staggered down the left of the basin: [name, left x, centre y, ground, ink]
  const springs: [string, number, number, string, string][] = [
    ['LLM.COMPLETION', 80, 130, s.ink, s.ground],
    ['EMBEDDING.CREATE', 150, 330, E0, s.ink],
    ['AGENT.TOOL_CALL', 60, 540, s.dim, s.ground],
    ['SEARCH.QUERY', 170, 730, s.ink, s.ground],
  ]
  // the ground: a slope across the sheet that closes about the centre line, faster the nearer the fold, with a
  // slow meander laid over it; the last stretch is the channel, where every line is drawn into the reducer
  const pull = (x: number) =>
    0.0004 + 0.0105 * Math.max(0, (x - left) / (outX - left)) ** 3
  const drift = (x: number, y: number) =>
    0.9 * Math.sin(x / 150 + y / 210) + 0.4 * Math.sin(x / 61 - y / 97)
  const channel = 200
  const lines: string[] = []
  const quiet: string[] = []
  const heads: string[] = []
  let n = 0
  springs.forEach(([t, sx, sy]) => {
    const x0 = sx + chipW(t) + 10
    for (let k = 0; k < 10; k++, n++) {
      let x = x0,
        y = sy - chipH * 1.3 + (chipH * 2.6 * (k + 0.5)) / 10 + (r() - 0.5) * 3
      const pts: [number, number][] = [[x, y]]
      while (x < outX) {
        const dy =
          -pull(x) * (y - cy) * 4 +
          drift(x, y + k * 41) *
            1.6 *
            Math.max(0, 1 - (x - x0) / (outX - x0)) ** 1.5
        const l = Math.hypot(dy, 4)
        y += (dy * 4) / l
        x = Math.min(outX, x + 16 / l)
        pts.push([x, y])
      }
      const done = pts.map(([px, py]) => {
        const u = Math.min(1, Math.max(0, (px - (outX - channel)) / channel))
        const e = u * u * (3 - 2 * u)
        return [px, py + (cy - py) * e] as [number, number]
      })
      done.push([outX - 7, cy])
      for (let i = 23; i < done.length - 1 && n % 3 === 0; i += 46) {
        const [x1, y1] = done[i],
          [xp, yp] = done[i - 1]
        if (x1 > outX - 140) break
        const a = Math.atan2(y1 - yp, x1 - xp)
        const h = (t: number) =>
          `M${(x1 - 9 * Math.cos(a + t)).toFixed(1)} ${(y1 - 9 * Math.sin(a + t)).toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`
        heads.push(h(0.45) + h(-0.45))
      }
      ;(n % 4 === 3 ? quiet : lines).push(polyline(done))
    }
  })
  // what leaves the fold, a step at a time: [step, chip, ground, ink, note]
  const steps: [string, string, string, string, string][] = [
    ['meter', '52,385 TOKENS', s.ink, s.ground, 'sum(metadata.tokens)'],
    ['price', '× $10 / 1M', s.dim, s.ground, 'LLM tokens, per unit'],
    ['invoice', '$0.52', E0, s.ink, 'one line, billed'],
  ]
  const sf = 24,
    sH = sf * 1.9,
    xs = [960, 1210, 1430]
  return (
    <Sheet
      s={s}
      w={W}
      h={H}
      title="A meter, as a watershed"
      cover={cover}
      // on Night it sits among the site's own dark panels, so the sheet is not lifted and its grain is quieter
      lift={stock === 'night' ? 0 : undefined}
      grain={stock === 'night' ? 0.08 : undefined}
    >
      <path d={quiet.join('')} fill="none" stroke={s.dim} strokeWidth={0.8} />
      <path d={lines.join('')} fill="none" stroke={s.ink} strokeWidth={0.9} />
      <path d={heads.join('')} fill="none" stroke={s.ink} strokeWidth={1} />
      {/* the fold, and the one line out of it, stepping across to the invoice */}
      <path
        d={`M${outX + 7} ${cy}H${xs[2]}`}
        stroke={s.ink}
        strokeWidth={2.4}
      />
      <rect
        x={outX - 7}
        y={cy - 7}
        width={14}
        height={14}
        fill={s.ground}
        stroke={s.ink}
        strokeWidth={1.4}
      />
      <T x={outX} y={cy - 150} size={18} fill={s.dim} anchor="middle">
        fold
      </T>
      <path
        d={`M${outX} ${cy - 136}V${cy - 20}`}
        stroke={s.dim}
        strokeWidth={0.8}
        strokeDasharray="2 4"
      />
      <T x={outX - 14} y={cy + 160} size={16} fill={s.ink}>
        {'reduce((n, e) => n + e.metadata.tokens, 0)'}
      </T>
      <path
        d={`M${outX} ${cy + 20}V${cy + 136}`}
        stroke={s.dim}
        strokeWidth={0.8}
        strokeDasharray="2 4"
      />
      {steps.map(([step, chip, g, ink, note], k) => {
        const x = xs[k]
        return (
          <g key={step}>
            <Tag
              x={x}
              y={cy - sH / 2}
              t={chip}
              g={g}
              ink={ink}
              fs={sf}
              anchor="middle"
            />
            <T x={x} y={cy - 150} size={18} fill={s.dim} anchor="middle">
              {step}
            </T>
            <path
              d={`M${x} ${cy - 136}V${cy - sH / 2 - 12}`}
              stroke={s.dim}
              strokeWidth={0.8}
              strokeDasharray="2 4"
            />
            <path
              d={`M${x} ${cy + sH / 2 + 12}V${cy + sH / 2 + 44}`}
              stroke={s.dim}
              strokeWidth={0.8}
            />
            <T
              x={x}
              y={cy + sH / 2 + 74}
              size={16}
              fill={s.dim}
              anchor="middle"
            >
              {note}
            </T>
          </g>
        )
      })}
      {springs.map(([t, x, y, g, ink]) => (
        <Tag key={t} x={x} y={y - chipH / 2} t={t} g={g} ink={ink} fs={fs} />
      ))}
    </Sheet>
  )
}

/* ---------- a stream, dumped ---------- */

function Ruler({
  s,
  x,
  y0,
  y1,
}: {
  s: Stock
  x: number
  y0: number
  y1: number
}) {
  const out: ReactNode[] = []
  for (let m = 0; m <= 60; m += 5) {
    const y = y0 + ((y1 - y0) * m) / 60
    out.push(
      <path
        key={`t${m}`}
        d={`M${x} ${y}h${m % 15 ? 8 : 16}`}
        stroke={s.ink}
        strokeWidth={1}
      />,
    )
    if (m % 15 === 0)
      out.push(
        <T key={`l${m}`} x={x + 24} y={y + 6} fill={s.dim} size={15}>
          {`:${String(m).padStart(2, '0')}`}
        </T>,
      )
  }
  return (
    <>
      <path d={`M${x} ${y0}V${y1}`} stroke={s.ink} strokeWidth={1} />
      {out}
    </>
  )
}

/**
 * Three sessions wander down a sheet of deep Ether against a minute ruler, and wherever an event fired, its
 * payload is dumped beside the line as xxd prints it: the offset in the stream, six bytes of hex, the same bytes
 * as text. A dropped event is set reversed.
 */
export function Dumped() {
  const s = STOCK.ether
  const W = 1150,
    H = 1500
  const r = rand('dumped')
  const y0 = 80,
    y1 = H - 80,
    rx = 56
  const size = 14,
    lh = 19
  const sessions = [
    { x: 320, w: 1.2, tone: s.ink, id: 'cus_7Q2f' },
    { x: 640, w: 0.9, tone: s.ink, id: 'cus_9Ke1' },
    { x: 890, w: 0.8, tone: s.dim, id: 'cus_2Bx8' },
  ]
  const fits = placer()
  const paths: ReactNode[] = []
  const dumps: ReactNode[] = []
  const dots: string[] = []
  const ticks: string[] = []
  let offset = 0x1a3c0
  sessions.forEach((ss, n) => {
    const ph = [r() * 6.28, r() * 6.28, r() * 6.28]
    const pts: [number, number][] = []
    for (let i = 0; i <= 150; i++) {
      const u = i / 150
      pts.push([
        ss.x +
          160 * Math.sin(u * 4.1 + ph[0]) +
          55 * Math.sin(u * 9.3 + ph[1]) +
          12 * Math.sin(u * 31 + ph[2]),
        y0 + (y1 - y0) * u,
      ])
    }
    paths.push(
      <path
        key={`p${n}`}
        d={polyline(pts)}
        fill="none"
        stroke={ss.tone}
        strokeWidth={ss.w}
      />,
    )
    for (
      let i = 3 + Math.floor(r() * 4);
      i < pts.length - 4;
      i += 8 + Math.floor(r() * 8)
    ) {
      const [px, py] = pts[i]
      const kind = KINDS[Math.floor(r() * KINDS.length)]
      const bytes = body(r, kind, ss.id)
      const named = r() < 0.25
      const rows = Math.min(
        Math.ceil(bytes.length / 6),
        2 + Math.floor(r() ** 2.2 * 6),
      )
      const dropped = r() < 0.07
      const from = named
        ? 0
        : Math.floor(r() * (Math.ceil(bytes.length / 6) - rows + 1))
      const width = dumpW(size)
      let side = (i + n) % 2 ? 1 : -1
      if (side > 0 && px + 38 + width > W - 40) side = -1
      else if (side < 0 && px - 38 - width < 110) side = 1
      const left = side > 0 ? px + 38 : px - 38 - width
      const top = py - 14 - (named ? lh : 0)
      const box = {
        x0: left - 10,
        x1: left + width + 10,
        y0: top - 6,
        y1: top + (rows + (named ? 1 : 0)) * lh + 10,
      }
      if (box.x0 < 100 || !fits(box)) continue
      offset += bytes.length + 1
      dots.push(`M${px - 3} ${py - 3}h6v6h-6z`)
      ticks.push(`M${px + side * 5} ${py}h${side * 26}`)
      const ink = dropped ? s.ground : ss.tone
      dumps.push(
        <DumpText
          key={`${n}-${i}`}
          x={left}
          y={top}
          size={size}
          rows={rowsOf(bytes, from, rows, offset)}
          ink={ink}
          dim={dropped ? ink : s.dim}
          inv={dropped ? s.ink : undefined}
          head={named ? kind : undefined}
          headInk={s.ink}
        />,
      )
    }
  })
  return (
    <Sheet s={s} w={W} h={H} title="A stream, dumped" fold="sixths" lift={0.03}>
      <Ruler s={s} x={rx} y0={y0} y1={y1} />
      {paths}
      <path d={ticks.join('')} stroke={s.dim} strokeWidth={1.1} />
      <path d={dots.join('')} fill={s.ink} />
      {dumps}
    </Sheet>
  )
}

/* ---------- a meter, defined ---------- */

/**
 * A meter as it is written and as it runs, on Night. Above, its definition as the API takes it; below, the same
 * definition run over a few events: the rows its filter turns away struck through, the tokens it keeps carried
 * off to the right and summed per customer. Ether numbers tie each part of the definition to what it does.
 */
export function Defined() {
  const s = STOCK.night
  const W = 1150,
    H = 1500
  const x0 = 130,
    fs = 24
  // the definition: [text, marker]
  const def: [string, number?][] = [
    ['POST /v1/meters'],
    [''],
    ['{'],
    ['  "name": "LLM tokens",'],
    ['  "filter": {', 1],
    ['    "conjunction": "and",'],
    ['    "clauses": [{'],
    ['      "property": "name",'],
    ['      "operator": "eq",'],
    ['      "value": "llm.completion"'],
    ['    }]'],
    ['  },'],
    ['  "aggregation": {', 2],
    ['    "func": "sum",'],
    ['    "property": "metadata.tokens"'],
    ['  }'],
    ['}'],
  ]
  const dy = 80,
    dlh = 34
  // the blocks each marker brackets: [first line, last line]
  const blocks: Record<number, [number, number]> = { 1: [4, 11], 2: [12, 15] }
  // the events it runs over: [name, customer, tokens]
  const events: [string, string, number][] = [
    ['llm.completion', 'cus_4410', 1840],
    ['api.request', 'cus_4410', 0],
    ['llm.completion', 'cus_2Bx8', 3120],
    ['llm.completion', 'cus_4410', 920],
    ['embedding.create', 'cus_2Bx8', 410],
    ['llm.completion', 'cus_4410', 2655],
    ['llm.completion', 'cus_2Bx8', 1408],
    ['api.request', 'cus_2Bx8', 0],
    ['llm.completion', 'cus_4410', 3310],
  ]
  const ty = 790,
    tlh = 50,
    cName = x0,
    cCus = x0 + 330,
    cTok = x0 + 640
  const customers = ['cus_4410', 'cus_2Bx8']
  const lanes = [cTok + 90, cTok + 170]
  const rows = events.map(([name, cus, tok], k) => ({
    name,
    cus,
    tok,
    y: ty + 60 + k * tlh,
    kept: name === 'llm.completion',
  }))
  const ry = ty + 60 + events.length * tlh + 70
  const totals = customers.map((c) =>
    rows.filter((e) => e.kept && e.cus === c).reduce((n, e) => n + e.tok, 0),
  )
  const marker = (n: number, x: number, y: number) => (
    <g key={`m${n}-${x}-${y}`}>
      <rect x={x - 16} y={y - 16} width={32} height={32} fill={E2} />
      <T x={x} y={y + 7} size={20} fill={NIGHT} anchor="middle">
        {String(n)}
      </T>
    </g>
  )
  const fmt = (n: number) => n.toLocaleString('en-US')
  return (
    <Sheet s={s} w={W} h={H} plain>
      {/* the definition */}
      {def.map(([t], k) => (
        <T
          key={k}
          x={x0}
          y={dy + k * dlh}
          size={fs}
          fill={k === 0 ? s.dim : s.ink}
        >
          {t}
        </T>
      ))}
      {Object.entries(blocks).map(([n, [a, b]]) => {
        const y0 = dy + a * dlh - 24,
          y1 = dy + b * dlh + 2,
          x = x0 + 560
        return (
          <g key={n}>
            <path
              d={`M${x} ${y0}h14V${y1}h-14`}
              fill="none"
              stroke={E2}
              strokeWidth={1.4}
            />
            {marker(Number(n), x + 44, (y0 + y1) / 2)}
          </g>
        )
      })}
      {/* what it does to the stream */}
      <path d={`M${x0} ${ty - 70}H${W - x0}`} stroke={s.rule} strokeWidth={1} />
      <T x={cName} y={ty} size={18} fill={s.dim}>
        NAME
      </T>
      <T x={cCus} y={ty} size={18} fill={s.dim}>
        CUSTOMER
      </T>
      <T x={cTok} y={ty} size={18} fill={s.dim} anchor="end">
        TOKENS
      </T>
      {marker(1, x0 - 50, ty - 6)}
      <path d={`M${x0} ${ty + 20}H${cTok}`} stroke={s.dim} strokeWidth={0.8} />
      {rows.map((e, k) => (
        <g key={k}>
          <T x={cName} y={e.y} size={fs} fill={e.kept ? s.ink : s.dim}>
            {e.name}
          </T>
          <T x={cCus} y={e.y} size={fs} fill={e.kept ? s.ink : s.dim}>
            {e.cus}
          </T>
          <T
            x={cTok}
            y={e.y}
            size={fs}
            fill={e.kept ? s.ink : s.dim}
            anchor="end"
          >
            {e.tok ? fmt(e.tok) : '-'}
          </T>
          {e.kept ? null : (
            // the filter turns it away
            <path
              d={`M${cName - 8} ${e.y - 7}H${cTok + 8}`}
              stroke={s.dim}
              strokeWidth={1.2}
            />
          )}
        </g>
      ))}
      {/* each customer's lane runs down into its sum, turning on a quarter round */}
      {customers.map((c, i) => {
        const first = rows.find((e) => e.kept && e.cus === c)!.y - 7
        const y = ry + i * tlh - 7,
          r = 14
        return (
          <g key={c}>
            <path
              d={`M${lanes[i]} ${first}V${y - r}Q${lanes[i]} ${y} ${lanes[i] - r} ${y}H${cTok + 20}`}
              fill="none"
              stroke={E2}
              strokeWidth={1.6}
            />
            <path
              d={chevron(cTok + 16, y, Math.PI, 10)}
              fill="none"
              stroke={E2}
              strokeWidth={1.6}
              strokeLinecap="square"
            />
          </g>
        )
      })}
      {/* each kept event: a hairline leader out to its lane, and a node knocked out of the night */}
      {rows
        .filter((e) => e.kept)
        .map((e, k) => {
          const x = lanes[customers.indexOf(e.cus)],
            y = e.y - 7
          return (
            <g key={`n${k}`}>
              <path
                d={`M${cTok + 16} ${y}H${x - 9}`}
                stroke={s.dim}
                strokeWidth={0.8}
                strokeDasharray="2 4"
              />
              <rect
                x={x - 5}
                y={y - 5}
                width={10}
                height={10}
                fill={s.ink}
                stroke={NIGHT}
                strokeWidth={3}
                paintOrder="stroke"
              />
            </g>
          )
        })}
      <path d={`M${x0} ${ry - 44}H${cTok}`} stroke={s.dim} strokeWidth={0.8} />
      {marker(2, x0 - 50, ry - 6)}
      {customers.map((c, i) => (
        <g key={c}>
          <T x={cCus} y={ry + i * tlh} size={fs} fill={s.ink}>
            {c}
          </T>
          <T x={cName} y={ry + i * tlh} size={fs} fill={s.dim}>
            sum
          </T>
          <T x={cTok} y={ry + i * tlh} size={fs} fill={E3} anchor="end">
            {fmt(totals[i])}
          </T>
        </g>
      ))}
    </Sheet>
  )
}

/* ---------- six aggregations, one stream ---------- */

export const STREAM = (() => {
  const r = rand('aggregations')
  return Array.from({ length: 31 }, () => ({
    tokens: 120 + Math.floor(r() ** 1.5 * 3600),
  }))
})()

export type Aggregation = 'count' | 'sum' | 'avg' | 'min' | 'max'

/* ---------- a statement, printed ---------- */

/** The stationery's tractor holes are cut through the sheet, a hole every half inch down each edge. */
const HOLE = (at: string) =>
  `radial-gradient(circle at ${at} 2.17cqw, transparent 0.74cqw, #000 0.83cqw)`
const holes: CSSProperties = {
  maskImage: `${HOLE('3.13cqw')}, ${HOLE('calc(100% - 3.13cqw)')}`,
  WebkitMaskImage: `${HOLE('3.13cqw')}, ${HOLE('calc(100% - 3.13cqw)')}`,
  maskSize: '100% 4.35cqw',
  WebkitMaskSize: '100% 4.35cqw',
  maskRepeat: 'repeat-y',
  WebkitMaskRepeat: 'repeat-y',
  maskComposite: 'intersect',
  WebkitMaskComposite: 'source-in',
}

/**
 * A meter's day as a line printer gives it, on Ether's tint: continuous stationery with tractor holes down both
 * edges, bands every three lines. On it one customer's usage statement, a line for each fifteen-minute window,
 * the running total beside it, and at the foot what it comes to.
 */
export function Printed() {
  const s = STOCK.paper
  const W = 1150,
    H = 1500
  const r = rand('printed')
  const band = '#f3f4f6'
  const C = 70,
    x0 = 108,
    size = (W - 2 * x0) / C / CW,
    lh = 26,
    top = 84
  const rows: string[] = []
  const fmt = (n: number) => n.toLocaleString('en-US')
  const line = (...cells: [string, number?][]) => {
    let out = ''
    for (const [t, right] of cells)
      out =
        right === undefined ? out + t : out.padEnd(right - t.length, ' ') + t
    return out
  }
  const E = 34,
    TK = 52
  rows.push(line(['POLAR SOFTWARE, INC.'], ['USAGE STATEMENT', C]))
  rows.push(line(['PAGE 0001', C]))
  rows.push('')
  rows.push(line(['CUSTOMER   cus_4410'], ['PERIOD  2026-11-13', C]))
  rows.push(
    line(['METER      llm_tokens'], ['AGGREGATION  sum(metadata.tokens)', C]),
  )
  rows.push(line(['FILTER     name = llm.completion']))
  rows.push('')
  rows.push(line(['WINDOW'], ['EVENTS', E], ['TOKENS', TK], ['RUNNING', C]))
  rows.push(
    line(['-----------'], ['------', E], ['--------', TK], ['-----------', C]),
  )
  let run = 0,
    events = 0
  const N = 36
  for (let k = 0; k < N; k++) {
    const h = 9 + Math.floor(k / 4),
      m = (k % 4) * 15
    const t0 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const t1 = `${String(h + (m === 45 ? 1 : 0)).padStart(2, '0')}:${String((m + 15) % 60).padStart(2, '0')}`
    const load = 0.35 + 0.65 * Math.sin((k / N) * Math.PI) + (r() - 0.5) * 0.3
    const ev = Math.max(3, Math.round(load * 180))
    const tok = Math.round(ev * (60 + r() * 50))
    run += tok
    events += ev
    rows.push(
      line([`${t0}-${t1}`], [String(ev), E], [fmt(tok), TK], [fmt(run), C]),
    )
  }
  const cents = Math.round((run * 10 * 100) / 1e6)
  rows.push(line(['------', E], ['--------', TK]))
  rows.push(line(['TOTAL'], [fmt(events), E], [fmt(run), TK]))
  rows.push('')
  rows.push(line(['RATE       $10.00 / 1,000,000 TOKENS']))
  rows.push(line(['AMOUNT DUE'], ['$' + (cents / 100).toFixed(2), C]))
  rows.push('')
  rows.push('*** END OF STATEMENT ***')
  const bands: ReactNode[] = []
  for (let k = 0; k * lh * 3 < H; k += 2)
    bands.push(
      <rect
        key={k}
        x={78}
        y={top - 18 + k * lh * 3}
        width={W - 156}
        height={lh * 3}
        fill={band}
      />,
    )
  return (
    <Sheet s={s} w={W} h={H} title="A statement, printed" sheet={holes}>
      {bands}
      <path
        d={`M78 0V${H}M${W - 78} 0V${H}`}
        stroke={s.dim}
        strokeWidth={1}
        strokeDasharray="1 5"
      />
      {rows.map((t, k) => (
        <T
          key={k}
          x={x0}
          y={top + k * lh}
          size={size}
          fill={s.ink}
          opacity={r() < 0.12 ? 0.72 : 1}
        >
          {t}
        </T>
      ))}
    </Sheet>
  )
}

/** The statement's foot, for the page to quote: the same seeded day the plate prints. */
export const STATEMENT = (() => {
  const r = rand('printed')
  let tokens = 0,
    events = 0
  for (let k = 0; k < 36; k++) {
    const load = 0.35 + 0.65 * Math.sin((k / 36) * Math.PI) + (r() - 0.5) * 0.3
    const ev = Math.max(3, Math.round(load * 180))
    tokens += Math.round(ev * (60 + r() * 50))
    events += ev
  }
  return { tokens, events, cents: Math.round((tokens * 10 * 100) / 1e6) }
})()

/* ---------- a customer's meter, read ---------- */

/**
 * What one customer's meter reads through a cycle, on Night: the consumed units climbing as a stair of fifteen-
 * minute windows, the credits granted as a ceiling, and in Ether the balance left between them.
 */
/** One customer's cycle, read every fifteen minutes: what the page quotes is what the plate draws. */
export const READING = (() => {
  const r = rand('read')
  const credited = 1_000_000
  let run = 0
  const vals: number[] = []
  for (let k = 0; k < 48; k++) {
    run += Math.round((0.4 + r() ** 2 * 1.4) * 15000)
    vals.push(run)
  }
  return { vals, consumed: run, credited, balance: credited - run }
})()

/**
 * One customer's meter, read live: the credit as a single bar, the consumed hatched in by plotter strokes up to an
 * Ether mark, and under it the tape of the last events, each one drawing the balance down.
 */
export function Read() {
  const s = STOCK.night
  const W = 1150,
    H = 1160
  const x0 = 110,
    x1 = W - 110
  const { credited, consumed, balance } = READING
  const fmt = (n: number) => n.toLocaleString('en-US')
  const xOf = (v: number) => x0 + ((x1 - x0) * v) / credited
  const xc = xOf(consumed)
  // the bar: the consumed part solid, what is left a hairline track
  const by = 280,
    bh = 14
  // the tape: the latest events, newest first, each balance the one before it less the event's tokens
  const r = rand('tape')
  // the meter only counts llm.completion, so the tape is all completions; the model is what varies
  const names = [
    'claude-sonnet',
    'claude-sonnet',
    'claude-haiku',
    'claude-opus',
  ]
  const tape: { t: string; name: string; tok: number; bal: number }[] = []
  let bal = balance,
    sec = 18 * 3600 - 2
  for (let k = 0; k < 13; k++) {
    const tok = 180 + Math.floor(r() ** 1.6 * 3400)
    const hh = Math.floor(sec / 3600),
      mm = Math.floor((sec % 3600) / 60),
      ss = sec % 60
    tape.push({
      t: [hh, mm, ss].map((n) => String(n).padStart(2, '0')).join(':'),
      name: names[Math.floor(r() * names.length)],
      tok,
      bal,
    })
    bal += tok
    sec -= 2 + Math.floor(r() * 9)
  }
  const ty = 440,
    lh = 46
  const cName = x0 + 190,
    cTok = x0 + 640
  return (
    <Sheet s={s} w={W} h={H} plain>
      <T x={x0} y={120} size={20} fill={s.ink}>
        {'cus_4410 · llm_tokens'}
      </T>
      <T x={x1} y={120} size={20} fill={s.dim} anchor="end">
        {'CREDITED 1,000,000'}
      </T>
      {/* the credit, and how much of it is gone */}
      <path d={`M${xc} ${by + bh / 2}H${x1}`} stroke={s.dim} strokeWidth={1} />
      <rect x={x0} y={by} width={xc - x0} height={bh} fill={s.ink} />
      <path
        d={`M${xc} ${by - 14}V${by + bh + 14}`}
        stroke={E2}
        strokeWidth={2}
      />
      <T x={x0} y={by - 30} size={18} fill={s.ink}>
        {`CONSUMED ${fmt(consumed)}`}
      </T>
      <T x={x1} y={by - 30} size={18} fill={E3} anchor="end">
        {`BALANCE ${fmt(balance)}`}
      </T>
      {/* the tape */}
      <T x={x0} y={ty} size={16} fill={s.dim}>
        TIME
      </T>
      <T x={cName} y={ty} size={16} fill={s.dim}>
        MODEL
      </T>
      <T x={cTok} y={ty} size={16} fill={s.dim} anchor="end">
        TOKENS
      </T>
      <T x={x1} y={ty} size={16} fill={s.dim} anchor="end">
        BALANCE
      </T>
      <path d={`M${x0} ${ty + 22}H${x1}`} stroke={s.rule} strokeWidth={1} />
      {tape.map((e, k) => {
        const y = ty + 70 + k * lh
        return (
          <g key={k} opacity={1 - k * 0.06}>
            {k === 0 ? (
              <rect x={x0 - 30} y={y - 15} width={12} height={12} fill={E2} />
            ) : null}
            <T x={x0} y={y} size={22} fill={s.dim}>
              {e.t}
            </T>
            <T x={cName} y={y} size={22} fill={s.ink}>
              {e.name}
            </T>
            <T x={cTok} y={y} size={22} fill={s.ink} anchor="end">
              {`−${fmt(e.tok)}`}
            </T>
            <T x={x1} y={y} size={22} fill={k === 0 ? E3 : s.ink} anchor="end">
              {fmt(e.bal)}
            </T>
          </g>
        )
      })}
    </Sheet>
  )
}
