import type { ReactNode } from 'react'
import { Sheet, MONO, Code } from '@/components/FieldGuide/sheet'
import {
  NIGHT_INK,
  LINE,
  MID,
  DIM,
  BG,
  HAIR,
  Anchor,
  Callout,
  Guide,
  term,
} from '@/components/FieldGuide/kit'

/**
 * The figures of the post, drawn with the manual's kit: Night plates, Snow hairlines, square anchors, dotted
 * leaders and mono labels. Each is one 16:9 SVG at 600 wide, with nothing but the drawing on it, in a card the
 * width of the post's images.
 */

export const W = 600
export const H = 338

/** `shift` moves the drawing so its content sits in the middle of the sheet. */
export function Plate({
  title,
  shift,
  children,
}: {
  title: string
  shift?: [number, number]
  children: ReactNode
}) {
  return (
    <figure className="not-prose dark:border-polar-800 my-12 overflow-hidden rounded-lg border border-gray-200 bg-[#141414] p-6 md:-mx-32 md:w-[calc(100%+16rem)] md:p-10">
      <Sheet w={W} h={H} surface="night" unsigned title={title}>
        <g transform={shift ? `translate(${shift[0]} ${shift[1]})` : undefined}>
          {children}
        </g>
      </Sheet>
    </figure>
  )
}

/** A labelled box with key and value rows, as the manual draws a record. */
export function Box({
  x,
  y,
  w,
  label,
  rows,
  tone = 'ink',
}: {
  x: number
  y: number
  w: number
  label: string
  rows: [string, string][]
  tone?: 'ink' | 'mid'
}) {
  const h = 26 + rows.length * 12
  const stroke = tone === 'ink' ? LINE : MID
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={BG}
        stroke={stroke}
        strokeWidth={HAIR}
      />
      <text
        x={x + 10}
        y={y + 14}
        fontSize={8.5}
        fill={tone === 'ink' ? LINE : DIM}
        style={MONO}
      >
        {label}
      </text>
      {rows.map(([k, v], i) => (
        <g key={k} style={{ ...MONO, letterSpacing: 0 }} fontSize={7.5}>
          <text x={x + 10} y={y + 30 + i * 12} fill={DIM}>
            {k}
          </text>
          <text x={x + w - 10} y={y + 30 + i * 12} fill={LINE} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
    </g>
  )
}

const STREAM: [string, number | null][] = [
  ['tokens.out', 412],
  ['api.call', null],
  ['tokens.out', 97],
  ['image.gen', null],
  ['tokens.out', 1204],
]

/** The fold: events enter, the filter keeps the matches, the aggregation bends them to one number, the meter reads it. */
export function MeterReducer() {
  const gate = 260
  const fold: [number, number] = [400, 150]
  const rowY = (i: number) => 70 + i * 40
  return (
    <Plate title="A meter is a reducer" shift={[-11, 19]}>
      {STREAM.map(([name, tokens], i) => {
        const y = rowY(i)
        const hit = tokens !== null
        return (
          <g key={i}>
            <text
              x={30}
              y={y + 2.5}
              fontSize={7.5}
              fill={hit ? LINE : DIM}
              style={{ ...MONO, letterSpacing: 0 }}
            >
              {name}
              {hit ? `  ${tokens.toLocaleString('en-US')}` : ''}
            </text>
            <line
              x1={130}
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
      <Guide a={[gate, 44]} b={[gate, 256]} />
      <Callout at={[gate, 44]} to={[gate + 16, 44]}>
        FILTER · name = tokens.out
      </Callout>
      <circle
        cx={fold[0]}
        cy={fold[1]}
        r={3}
        fill={BG}
        stroke={LINE}
        strokeWidth={HAIR}
      />
      <Callout at={fold} to={[fold[0], 256]} route="v">
        AGGREGATION · sum(metadata.tokens)
      </Callout>
      <Callout at={fold} to={[fold[0], 66]} route="v">
        REDUCER · RUNS ONCE AT INGESTION
      </Callout>
      <line
        x1={fold[0]}
        x2={470}
        y1={fold[1]}
        y2={fold[1]}
        stroke={LINE}
        strokeWidth={HAIR}
      />
      <Anchor at={[470, fold[1]]} />
      <Box
        x={470}
        y={fold[1] - 19}
        w={110}
        label="METER"
        rows={[['name', 'Output tokens']]}
        tone="mid"
      />
    </Plate>
  )
}

/** One bucket row, and how any period's quantity is recovered from rows. */
export function BucketRow() {
  const t = term(80, 70, 7.5, 14)
  const row = (i: number, k: string, v: string, tone?: 'dim') =>
    t.line(
      i,
      0,
      [
        { t: k, tone: 'dim', w: 15 },
        { t: v, tone },
      ],
      `r${i}`,
    )
  const rows: [string, string][] = [
    ['reducer_id', 'rd_8f21'],
    ['customer_id', 'cus_4a9c'],
    ['bucket_start', '2026-10-13 12:00:00'],
    ['bucket_end', '2026-10-13 12:05:00'],
    ['count', '1,284'],
    ['sum', '917,402'],
    ['min', '12'],
    ['max', '4,096'],
    ['generation', '1'],
    ['sealed_at', 'null'],
  ]
  const d = term(380, 70, 7.5, 14)
  const derive: [string, string][] = [
    ['count', 'Σ count'],
    ['sum', 'Σ sum'],
    ['avg', 'Σ sum / Σ count'],
    ['min', 'min(min)'],
    ['max', 'max(max)'],
  ]
  return (
    <Plate title="What a bucket holds" shift={[32, 10]}>
      {t.bar(0, 9)}
      {rows.map(([k, v], i) => row(i, k, v, i >= 8 ? 'dim' : undefined))}
      {d.line(0, 0, [{ t: 'QUANTITY FOR A PERIOD', tone: 'dim' }], 'dh')}
      {derive.map(([k, v], i) =>
        d.line(i + 2, 0, [{ t: k, tone: 'dim', w: 8 }, { t: v }], `d${i}`),
      )}
      <Guide a={[240, 126]} b={[360, 126]} />
      <Anchor at={[240, 126]} />
      <Anchor at={[360, 126]} />
      <Callout at={[300, 126]} to={[300, 250]} route="v" dot={false}>
        ADDED UP · NEVER RECOUNTED
      </Callout>
    </Plate>
  )
}

const CONFIG = [
  'meters: ({ meter, events }) => ({',
  "  tokens: meter('Output tokens')",
  "    .on(events['tokens.out'])",
  "    .sum('tokens'),",
  "  calls: meter('API calls')",
  "    .on(events['api.call'])",
  '    .count(),',
  "  seconds: meter('Session length')",
  "    .on(events['session.end'])",
  "    .max('seconds'),",
  '}),',
]

/** The meters as you define them in code, and the reducers Outpost receives for them. */
export function SameFold() {
  const reducers: [string, string][] = [
    ['rd_8f21', 'sum(metadata.tokens)'],
    ['rd_c04e', 'count'],
    ['rd_21aa', 'max(metadata.seconds)'],
  ]
  return (
    <Plate title="The same fold, on both sides" shift={[0, 5]}>
      <rect
        x={30}
        y={100}
        width={210}
        height={134}
        fill={BG}
        stroke={MID}
        strokeWidth={HAIR}
      />
      <Code x={42} y={118} lines={CONFIG} ink={NIGHT_INK} size={7.5} lh={1.4} />
      <Callout at={[54, 100]} to={[54, 78]} route="v" dot={false}>
        polar.config.ts · IN GIT
      </Callout>
      <Box
        x={360}
        y={136}
        w={210}
        label="OUTPOST · NEXT TO YOUR CODE"
        rows={reducers}
      />
      <Guide a={[240, 167]} b={[360, 167]} />
      <Anchor at={[240, 167]} />
      <Anchor at={[360, 167]} />
      <Callout at={[300, 167]} to={[300, 250]} route="v" dot={false}>
        CONFIGURATION · OVER THE SOCKET
      </Callout>
    </Plate>
  )
}
