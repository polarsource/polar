import { MONO } from '../sheet'
import { Anchor, BG, Callout, DIM, DOTTED, HAIR, LINE, MID } from '../kit'
import { landscape } from './more'

/**
 * The third principle, before the machinery of chapter 04: your app asks Outpost, which answers at once from its own
 * Redis, while the line on to Polar syncs in the background.
 */

const Y = 180,
  BH = 40
const BOXES: [string, string, number][] = [
  ['YOUR APP', 'check()', 40],
  ['OUTPOST', 'your redis', 190],
  ['POLAR', 'event log', 400],
]
const BW = 100
const MID_Y = Y + BH / 2

const text = (x: number, y: number, t: string, fill = DIM, size = 7.5) => (
  <text
    x={x}
    y={y}
    fontSize={size}
    fill={fill}
    textAnchor="middle"
    style={{ ...MONO, letterSpacing: 0 }}
  >
    {t}
  </text>
)

const app = BOXES[0][2] + BW,
  outpost = BOXES[1][2],
  outpostEnd = BOXES[1][2] + BW,
  polar = BOXES[2][2]
const sync = (outpostEnd + polar) / 2

const figure = (
  <>
    {BOXES.map(([name, sub, x]) => (
      <g key={name}>
        <rect
          x={x}
          y={Y}
          width={BW}
          height={BH}
          fill={BG}
          stroke={LINE}
          strokeWidth={HAIR}
        />
        {text(x + BW / 2, Y + 16, name)}
        {text(x + BW / 2, Y + 29, sub, LINE)}
      </g>
    ))}

    <line
      x1={app}
      x2={outpost}
      y1={MID_Y}
      y2={MID_Y}
      stroke={LINE}
      strokeWidth={HAIR}
    />
    <Anchor at={[app, MID_Y]} />
    <Anchor at={[outpost, MID_Y]} />

    <line
      x1={outpostEnd}
      x2={polar}
      y1={MID_Y}
      y2={MID_Y}
      stroke={MID}
      strokeWidth={HAIR}
      {...DOTTED}
    />

    <Callout
      at={[(app + outpost) / 2, MID_Y]}
      to={[(app + outpost) / 2, Y + BH + 36]}
      route="v"
    >
      ZERO LATENCY
    </Callout>
    <Callout at={[sync, MID_Y]} to={[sync, Y + BH + 36]} route="v">
      SYNCS IN THE BACKGROUND
    </Callout>
  </>
)

export const faultTolerance = landscape(
  'm-tolerant',
  'Zero latency & fault tolerance',
  'Checks are answered next to your code, without waiting on the network.',
  'Your app asks Outpost, which answers at once from your own Redis. Outpost and Polar sync in the background, off the path of the check.',
  figure,
  [
    [
      'Next to your code',
      [
        'Checks are answered by Outpost inside your app, from state kept in your own Redis. There is no round trip to Polar.',
      ],
    ],
    [
      'Off the network path',
      [
        'Outpost answers from the state it holds, so a slow or dropped connection never holds up a check.',
      ],
    ],
    [
      'Always in sync',
      [
        'Events flow to Polar in the background, and Polar’s numbers settle the local ones as they arrive.',
      ],
    ],
  ],
)
