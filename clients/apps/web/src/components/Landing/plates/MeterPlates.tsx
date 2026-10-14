import { MONO } from '@/components/FieldGuide/sheet'
import {
  LINE,
  MID,
  DIM,
  BG,
  HAIR,
  Anchor,
  Callout,
  Guide,
  Hatch,
  term,
} from '@/components/FieldGuide/kit'
import { Axis, Record, Slot, Tile } from './Tile'

const LEDGER: [string, string, string][] = [
  ['0138', 'tokens.out', '412'],
  ['0139', 'api.call', '1'],
  ['0140', 'tokens.out', '97'],
  ['0141', 'image.gen', '2'],
  ['0142', 'tokens.out', '1,204'],
  ['0143', 'gpu.seconds', '38'],
  ['0144', 'tokens.out', '337'],
]

/** The ledger: every event in order, the head at the bottom. */
export function MeasurePlate() {
  const t = term(64, 72, 8.5, 24)
  const last = LEDGER.length - 1
  return (
    <Tile title="Every event, recorded in order">
      {t.bar(0, last)}
      {LEDGER.map(([n, name, qty], i) =>
        t.line(
          i,
          0,
          [
            { t: n, tone: 'dim', w: 6 },
            { t: name, w: 13 },
            { t: qty, tone: i === last ? undefined : 'dim' },
          ],
          `r${i}`,
        ),
      )}
      {t.gutter(last)}
      <Callout at={[224, 72 + last * 24 - 3]} to={[248, 72 + last * 24 - 3]}>
        NOW
      </Callout>
    </Tile>
  )
}

const STREAM: [string, number | null][] = [
  ['tokens.out', 412],
  ['api.call', null],
  ['tokens.out', 97],
  ['image.gen', null],
  ['tokens.out', 1204],
]

/** The fold: the filter keeps the matches, the aggregation bends them to one number. */
export function AggregatePlate() {
  const gate = 150
  const fold: [number, number] = [218, 140]
  const rowY = (i: number) => 60 + i * 40
  return (
    <Tile title="Events fold into one meter reading">
      {STREAM.map(([name, tokens], i) => {
        const y = rowY(i)
        const hit = tokens !== null
        return (
          <g key={i}>
            <text
              x={22}
              y={y + 2.5}
              fontSize={7.5}
              fill={hit ? LINE : DIM}
              style={{ ...MONO, letterSpacing: 0 }}
            >
              {name}
            </text>
            <line
              x1={100}
              x2={gate}
              y1={y}
              y2={y}
              stroke={hit ? LINE : MID}
              strokeWidth={HAIR}
            />
            {hit ? (
              <line
                x1={gate}
                y1={y}
                x2={fold[0]}
                y2={fold[1]}
                stroke={LINE}
                strokeWidth={HAIR}
              />
            ) : (
              <Anchor at={[gate, y]} />
            )}
          </g>
        )
      })}
      <Guide a={[gate, 36]} b={[gate, 244]} />
      <Callout at={[gate, 36]} to={[gate + 14, 36]}>
        FILTER
      </Callout>
      <circle
        cx={fold[0]}
        cy={fold[1]}
        r={3}
        fill={BG}
        stroke={LINE}
        strokeWidth={HAIR}
      />
      <Callout at={fold} to={[fold[0], 244]} route="v" side="left">
        sum(tokens)
      </Callout>
      <line
        x1={fold[0]}
        x2={270}
        y1={fold[1]}
        y2={fold[1]}
        stroke={LINE}
        strokeWidth={HAIR}
      />
      <Anchor at={[270, fold[1]]} />
      <text
        x={270}
        y={fold[1] - 10}
        fontSize={8.5}
        fill={LINE}
        textAnchor="end"
        style={MONO}
      >
        Σ 1,713
      </text>
    </Tile>
  )
}

/** Sealed buckets become the line on the invoice. */
export function BillPlate() {
  const x0 = 36,
    sw = 57,
    y = 96,
    h = 28
  const slot = (i: number) => x0 + i * sw
  const events: [number, number][] = [
    [50, 40],
    [72, 62],
    [104, 48],
    [128, 70],
    [150, 36],
    [182, 58],
    [204, 44],
    [240, 66],
  ]
  return (
    <Tile title="Usage lands on the invoice">
      <Hatch id="tile-seal" />
      {events.map(([ex, ey]) => (
        <g key={ex}>
          <Guide a={[ex, ey + 4]} b={[ex, y]} />
          <Anchor at={[ex, ey]} />
        </g>
      ))}
      {[0, 1, 2].map((i) => (
        <Slot key={i} x={slot(i)} y={y} w={sw} h={h} tone="sealed" />
      ))}
      <Slot x={slot(3)} y={y} w={sw} h={h} label="OPEN" tone="mid" />
      <Axis
        x0={x0}
        y={y + h + 8}
        sw={sw}
        labels={['NOV 1', '', '', '', 'DEC 1']}
      />
      <Guide a={[slot(1) + sw / 2, y + h + 24]} b={[slot(1) + sw / 2, 196]} />
      <Anchor at={[slot(1) + sw / 2, 196]} />
      <Record
        x={36}
        y={196}
        w={228}
        label="INVOICE · DEC 1"
        rows={[
          ['Lumen Pro', '$49.00'],
          ['AI tokens · 642,111,144', '$1,284.22'],
        ]}
      />
    </Tile>
  )
}
