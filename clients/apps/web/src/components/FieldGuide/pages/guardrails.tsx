import { MONO } from '../sheet'
import { LINE, MID, DIM, BG, HAIR, DOTTED, Anchor, Guide } from '../kit'
import { landscape } from './more'

/**
 * Guardrails: a number Polar already keeps, a threshold on it, and a signal where the number crosses it. Both pages
 * are drawn the same way: the number above, the threshold dotted across it, a signal at each crossing, and below, the
 * lane the side effect switches.
 */

const X0 = 70,
  X1 = 390
const THRESHOLD = 210
const LANE = 276
const LABELS = 132

const label = (
  x: number,
  y: number,
  t: string,
  anchor: 'start' | 'middle' | 'end' = 'start',
  fill = DIM,
) => (
  <text
    x={x}
    y={y}
    fontSize={7.5}
    fill={fill}
    textAnchor={anchor}
    style={{ ...MONO, letterSpacing: 0 }}
  >
    {t}
  </text>
)

function threshold({
  number,
  path,
  enter,
  exit,
  lane,
  states,
}: {
  /** What the line measures, set beside its start. */
  number: string
  path: string
  /** Where the line crosses into the condition, and where it leaves it. */
  enter: number
  exit: number
  /** What the side effect switches, and its state before, during and after. */
  lane: string
  states: [string, string, string]
}) {
  const spans: [number, number, string, boolean][] = [
    [X0, enter, states[0], false],
    [enter, exit, states[1], true],
    [exit, X1, states[2], false],
  ]
  return (
    <>
      {label(X0 - 8, 154, number, 'end')}
      <line
        x1={X0}
        x2={X1}
        y1={THRESHOLD}
        y2={THRESHOLD}
        stroke={MID}
        strokeWidth={HAIR}
        {...DOTTED}
      />
      {label(X0 - 8, THRESHOLD + 2.5, 'THRESHOLD', 'end')}
      {/* the line twice, each half clipped at the threshold: dim while clear of it, Snow inside the condition */}
      <defs>
        <clipPath id={`${number}-over`}>
          <rect x={X0 - 4} y={0} width={X1 - X0 + 8} height={THRESHOLD} />
        </clipPath>
        <clipPath id={`${number}-under`}>
          <rect
            x={X0 - 4}
            y={THRESHOLD}
            width={X1 - X0 + 8}
            height={LANE - THRESHOLD}
          />
        </clipPath>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={MID}
        strokeWidth={HAIR}
        clipPath={`url(#${number}-over)`}
      />
      <path
        d={path}
        fill="none"
        stroke={LINE}
        strokeWidth={HAIR}
        clipPath={`url(#${number}-under)`}
      />

      {(
        [
          [enter, 'SIGNAL · ENTER'],
          [exit, 'SIGNAL · EXIT'],
        ] as const
      ).map(([x, t]) => (
        <g key={t}>
          <Guide a={[x, THRESHOLD - 4]} b={[x, LABELS + 4]} />
          {label(x + 6, LABELS + 2, t)}
          <Guide a={[x, THRESHOLD + 4]} b={[x, LANE]} />
          <Anchor at={[x, THRESHOLD]} />
        </g>
      ))}

      {label(X0 - 8, LANE + 11.5, lane, 'end')}
      {/* the active span last, so the edges it shares are drawn over its neighbours' */}
      {spans
        .toSorted(([, , , x], [, , , y]) => Number(x) - Number(y))
        .map(([a, b, t, active]) => (
          <g key={a}>
            <rect
              x={a}
              y={LANE}
              width={b - a}
              height={18}
              fill={BG}
              stroke={active ? LINE : MID}
              strokeWidth={HAIR}
            />
            {label((a + b) / 2, LANE + 11.5, t, 'middle', active ? LINE : DIM)}
          </g>
        ))}
    </>
  )
}

// Credits, drawn down by usage in steps; they fall through a fifth of the grant, and a grant lifts them back out.
const credits = threshold({
  number: 'CREDITS',
  path: 'M70 150H90V162H110V174H130V186H150V198H170V206H190V214H210V222H230V230H250V238H270V160H290V166H320V172H350V178H390',
  enter: 190,
  exit: 270,
  lane: 'MODEL',
  states: ['claude-opus-5-5', 'gemini-flash', 'claude-opus-5-5'],
})

// Margin per customer, sliding below the floor as costs climb and back over it as they ease.
const margin = threshold({
  number: 'MARGIN',
  path: 'M70 170L130 180L170 196L200 210L230 228L260 232L290 222L310 210L340 192L390 184',
  enter: 200,
  exit: 310,
  lane: 'ACCESS',
  states: ['open', 'rate limited', 'open'],
})

export const signals = landscape(
  'm-signals',
  'Signals',
  'A side effect that runs when a number enters or leaves a threshold.',
  'Credits stepping down through a threshold and back out after a grant: a signal at each crossing, and the model the customer is on switching from Opus to Gemini Flash and back.',
  credits,
  [
    [
      'A condition',
      [
        'Register a condition on a number Polar already keeps: a meter, a credit balance, a margin. Here, a customer’s credits falling below a fifth of their grant.',
      ],
    ],
    [
      'Enter and exit',
      [
        'The signal fires when the number crosses into the condition, and again when it leaves, so a side effect runs once per crossing.',
      ],
    ],
    [
      'Ahead of time',
      [
        'Signals run at runtime, on the zero-latency state, so you act before the limit is hit: the customer moves to a cheaper model before their credits run out, and back when a grant lands.',
      ],
    ],
  ],
)

export const marginFloor = landscape(
  'm-margin',
  'Margin floor',
  'When a customer’s margin drops below a minimum, slow them down.',
  'Margin per customer sliding below a floor and back: a signal at each crossing, and the customer rate-limited while the margin is under it.',
  margin,
  [
    [
      'Margin',
      [
        'Events carry their cost, so Polar knows revenue and cost per customer as they happen, and the margin between them.',
      ],
    ],
    [
      'A floor',
      [
        'Set a minimum margin. When a customer falls below it, the signal fires: rate-limit them, or route them to a cheaper model.',
      ],
    ],
    [
      'Lifted again',
      [
        'When the margin recovers, the exit fires and the limit comes off. The rule is code, kept next to the rest of your billing.',
      ],
    ],
  ],
)
