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

/**
 * The file, reviewed as a diff: each line an indent, a height and an end, and a gutter mark on the lines that
 * changed, a minus for the line taken out and a plus, in Snow, for the two put in.
 */
const CODE_LINES: [number, number, number, ('-' | '+')?][] = [
  [46, 40, 70],
  [52, 48, 76, '-'],
  [52, 56, 72, '+'],
  [58, 64, 78, '+'],
  [52, 72, 70],
  [46, 80, 60],
]

const code = (
  <>
    <path d="M34 22H74L86 34V98H34Z" stroke={INK} />
    <path d="M74 22V34H86" stroke={DIM} />
    {CODE_LINES.map(([x, y, x2, mark]) => (
      <g key={y}>
        {line(x, y, x2, y, mark === '+' ? INK : mark === '-' ? FAINT : DIM)}
        {mark ? line(38, y, 42, y, mark === '+' ? INK : DIM) : null}
        {mark === '+' ? line(40, y - 2, 40, y + 2, INK) : null}
      </g>
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

/**
 * The Signals page, reduced: a balance dropping through a dotted threshold and lifted back over it, and below, a line
 * lit for as long as the balance is under.
 */
const ENTER = 58,
  EXIT = 74

const guardrails = (
  <>
    <line x1={20} y1={52} x2={100} y2={52} stroke={DIM} {...DOTS} />
    <path d="M22 36H40V44H58V62H74V40H98" stroke={INK} />
    {[ENTER, EXIT].map((x) => (
      <line key={x} x1={x} y1={64} x2={x} y2={81} stroke={FAINT} {...DOTS} />
    ))}
    <line x1={22} y1={84} x2={ENTER} y2={84} stroke={DIM} {...DOTS} />
    {line(ENTER, 84, EXIT, 84, INK)}
    <line x1={EXIT} y1={84} x2={98} y2={84} stroke={DIM} {...DOTS} />
  </>
)

/** A branch: production along the bottom, a pricing branch forking off it, replayed, and merged back in. */
const simulations = (
  <>
    {line(20, 76, 100, 76, INK)}
    <path d="M36 76C46 76 42 48 54 48H66C78 48 74 76 84 76" stroke={DIM} />
    {[36, 84].map((x) => (
      <circle key={x} cx={x} cy={76} r={3} stroke={INK} fill="#141414" />
    ))}
    {[54, 66].map((x) => (
      <circle key={x} cx={x} cy={48} r={2.5} stroke={DIM} fill="#141414" />
    ))}
    <line x1={60} y1={52} x2={60} y2={72} stroke={FAINT} {...DOTS} />
  </>
)

/** One billing engine above, three processors beneath it, one of them wired in. */
const payments = (
  <>
    <rect x={44} y={26} width={32} height={20} stroke={INK} />
    {line(60, 46, 60, 66, INK)}
    <line x1={30} y1={66} x2={90} y2={66} stroke={DIM} {...DOTS} />
    {line(60, 66, 30, 66, INK)}
    {[30, 60, 90].map((x, i) => (
      <g key={x}>
        {i === 0 ? (
          line(x, 66, x, 80, INK)
        ) : (
          <line x1={x} y1={66} x2={x} y2={80} stroke={DIM} {...DOTS} />
        )}
        <rect
          x={x - 9}
          y={80}
          width={18}
          height={14}
          stroke={i === 0 ? INK : DIM}
          fill={i === 0 ? INK : 'none'}
        />
      </g>
    ))}
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

/** One state line, the subscription's, drives every switch: two closed, their entitlements lit, one open. */
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

/** Identities, nested: a company at the root, two identities under it, three under each: a tree, read top down. */
const AGENTS = [36, 84]
const actorsOf = (x: number) => [x - 14, x, x + 14]

const identities = (
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

/** Each chapter's poster, by its name, so renumbering the book never moves a drawing. */
export const POSTERS: Record<string, ReactNode> = {
  'Billing as code': code,
  Events: log,
  Meters: fold,
  'Local-first': local,
  Guardrails: guardrails,
  Simulations: simulations,
  Credits: credits,
  Entitlements: gates,
  'Bring your own PSP': payments,
  Identities: identities,
}
