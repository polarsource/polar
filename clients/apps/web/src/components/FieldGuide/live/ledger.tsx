import { MONO } from '../sheet'
import { LINE, DIM, MID, RULE, HAIR } from '../kit'
import { useSim, type SimEvent } from '../simulation'

/** An event's metadata as the row has room for it: the field that carries the measurement, and an ellipsis. */
const metadata = (e: SimEvent) => {
  switch (e.name) {
    case 'llm.completion':
      return `{ output_tokens: ${e.quantity}, … }`
    case 'image.gen':
      return `{ images: ${e.quantity}, … }`
    case 'api.call':
      return '{ route: "/v1/runs", … }'
    case 'credit.granted':
      return `{ credits: ${e.quantity} }`
  }
}

/** The ledger page, running: the last rows of the real ledger, the head in ink at the bottom. */
export function LiveLedger({
  x,
  w,
  top,
  rh,
  past,
}: {
  x: number
  w: number
  top: number
  rh: number
  past: number
}) {
  const sim = useSim((s) => s)
  const rows = sim.events.slice(-(past + 1))
  const rowY = (i: number) => top + i * rh
  return (
    <g data-live>
      {rows.map((e, i) => {
        const head = i === rows.length - 1
        const y = rowY(past - (rows.length - 1) + i)
        const ink = head ? LINE : DIM
        return (
          <g
            key={e.id}
            style={{ animation: head ? 'fg-appear 500ms both' : undefined }}
          >
            <text
              x={x - 8}
              y={y + 3}
              fontSize={7.5}
              fill={ink}
              textAnchor="end"
              style={MONO}
            >
              {String(e.n).padStart(4, '0')}
            </text>
            <text
              x={x}
              y={y + 3}
              fontSize={7.5}
              fill={head ? LINE : MID}
              style={MONO}
            >
              {e.name}
            </text>
            <text
              x={x + 74}
              y={y + 3}
              fontSize={7.5}
              fill={head ? LINE : MID}
              style={MONO}
            >
              {e.actor}
            </text>
            <text
              x={x + 140}
              y={y + 3}
              fontSize={7.5}
              fill={ink}
              style={{ ...MONO, letterSpacing: 0 }}
            >
              {metadata(e)}
            </text>
            <line
              x1={x}
              x2={x + w}
              y1={y + 8}
              y2={y + 8}
              stroke={head ? LINE : RULE}
              strokeWidth={HAIR}
            />
          </g>
        )
      })}
    </g>
  )
}
