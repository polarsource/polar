import type { ReactNode } from 'react'

/**
 * One small drawing per chapter, for the contents grid: the chapter's idea reduced to a few hairlines on a 120 square.
 * Snow for the subject, Mist for what stands behind it.
 */

const INK = '#d8d8d8'
const DIM = '#7b7b7b'
const FAINT = '#4a4a4a'
const DOTS = { strokeDasharray: '0.1 3', strokeLinecap: 'round' } as const

const line = (x1: number, y1: number, x2: number, y2: number, stroke = DIM) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} />
)

/** The code lines of the file: indent, height, end, and the one line in Snow. */
const CODE_LINES: [number, number, number, string?][] = [
  [42, 44, 70],
  [48, 52, 76],
  [48, 60, 64],
  [54, 68, 78, INK],
  [48, 76, 70],
  [42, 84, 58],
]

const code = (
  <>
    <path d="M34 22H74L86 34V98H34Z" stroke={INK} />
    <path d="M74 22V34H86" stroke={DIM} />
    {CODE_LINES.map(([x, y, x2, stroke = DIM]) => (
      <g key={y}>{line(x, y, x2, y, stroke)}</g>
    ))}
  </>
)

const fold = (
  <>
    {Array.from({ length: 9 }, (_, i) => {
      const y = 26 + i * 8.5
      return <path key={i} d={`M22 ${y}C46 ${y} 50 60 70 60`} stroke={DIM} />
    })}
    {line(70, 60, 98, 60, INK)}
    <circle cx={70} cy={60} r={3} stroke={INK} fill="#141414" />
    <circle cx={98} cy={60} r={1.6} fill={INK} stroke="none" />
  </>
)

/** A replica: Polar's buckets above, the same buckets kept beside your code below, the newest one only local yet. */
const REPLICA = [28, 46, 64, 82]

const local = (
  <>
    {REPLICA.map((x, i) => {
      const newest = i === REPLICA.length - 1
      return (
        <g key={x}>
          <rect
            x={x}
            y={34}
            width={12}
            height={12}
            stroke={newest ? FAINT : DIM}
          />
          <line x1={x + 6} y1={50} x2={x + 6} y2={70} stroke={DIM} {...DOTS} />
          <rect
            x={x}
            y={74}
            width={12}
            height={12}
            stroke={INK}
            fill={newest ? INK : 'none'}
          />
        </g>
      )
    })}
  </>
)

/** A balance drawn down by usage, step by step, and lifted by a grant before it reaches zero. */
const DRAIN = [
  'M22 32H30V38H38V44H46V50H54V56H62V62H68',
  'V30',
  'H76V36H84V42H92V48H98',
].join('')

const credits = (
  <>
    <line x1={20} y1={76} x2={100} y2={76} stroke={FAINT} {...DOTS} />
    <path d={DRAIN} stroke={INK} />
    <rect x={65} y={27} width={6} height={6} stroke={INK} fill="#141414" />
    {line(68, 18, 68, 24, DIM)}
    {line(65, 21, 71, 21, DIM)}
    {line(68, 62, 68, 76, FAINT)}
  </>
)

/** One state line, the subscription's, drives every switch: two closed, their benefits lit, one open. */
const GATES: [number, boolean][] = [
  [36, true],
  [60, false],
  [84, true],
]

const gates = (
  <>
    <rect x={18} y={55} width={10} height={10} fill={INK} stroke="none" />
    {line(28, 60, 42, 60, INK)}
    {line(42, 36, 42, 84, INK)}
    {GATES.map(([y, on]) => (
      <g key={y}>
        {line(42, y, 56, y, INK)}
        <circle cx={58} cy={y} r={2} stroke={INK} fill="#141414" />
        {on ? line(60, y, 72, y, INK) : line(60, y, 71, y - 9, DIM)}
        <circle cx={74} cy={y} r={2} stroke={on ? INK : DIM} fill="#141414" />
        {line(76, y, 88, y, on ? INK : FAINT)}
        <rect
          x={88}
          y={y - 5}
          width={10}
          height={10}
          stroke={on ? INK : DIM}
          fill={on ? INK : 'none'}
        />
      </g>
    ))}
  </>
)

/** The customer at the root, two agents under it, three actors under each: a tree, read top down. */
const AGENTS = [36, 84]
const actorsOf = (x: number) => [x - 14, x, x + 14]

const agents = (
  <>
    <rect x={54} y={22} width={12} height={12} stroke={INK} />
    <path d={`M60 34V44M${AGENTS[0]} 44H${AGENTS[1]}`} stroke={DIM} />
    {AGENTS.map((x) => (
      <g key={x}>
        {line(x, 44, x, 54)}
        <rect x={x - 5} y={54} width={10} height={10} stroke={INK} />
        <path d={`M${x} 64V76M${x - 14} 76H${x + 14}`} stroke={DIM} />
        {actorsOf(x).map((ax) => (
          <g key={ax}>
            {line(ax, 76, ax, 86)}
            <rect x={ax - 3.5} y={86} width={7} height={7} stroke={DIM} />
          </g>
        ))}
      </g>
    ))}
  </>
)

/** The event log: rows of entries, each run out to its place with leader dots. */
const log = (
  <>
    {[30, 42, 54, 66, 78, 90].map((y, i) => (
      <g key={y}>
        {line(28, y, 46 + (i % 3) * 6, y, i === 0 ? INK : DIM)}
        <line
          x1={58 + (i % 3) * 6}
          y1={y}
          x2={84}
          y2={y}
          stroke={FAINT}
          {...DOTS}
        />
        {line(88, y, 92, y, DIM)}
      </g>
    ))}
  </>
)

/** A glossary: a term in Snow, its definition beside it in two shorter lines, three times down the page. */
const glossary = (
  <>
    {[32, 58, 84].map((y, i) => (
      <g key={y}>
        {line(26, y, 44 + (i % 2) * 6, y, INK)}
        {line(58, y, 94, y)}
        {line(58, y + 8, 82 - (i % 2) * 10, y + 8, FAINT)}
      </g>
    ))}
  </>
)

/** Each chapter's poster, by its name, so renumbering the book never moves a drawing. */
export const POSTERS: Record<string, ReactNode> = {
  'Billing as code': code,
  Events: log,
  Meters: fold,
  'Local-first': local,
  Credits: credits,
  Entitlements: gates,
  Agents: agents,
  Appendix: glossary,
}
