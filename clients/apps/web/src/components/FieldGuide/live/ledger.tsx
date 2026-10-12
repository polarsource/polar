import { MONO } from '../sheet'
import { LINE, DIM, MID, RULE, HAIR, DOTTED } from '../kit'
import { num, useSim } from '../simulation'

/** The ledger page, running: the last rows of the real ledger, the head in ink, the next lines still empty. */
export function LiveLedger({
  x,
  w,
  top,
  rh,
  past,
  future,
}: {
  x: number
  w: number
  top: number
  rh: number
  past: number
  future: number
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
              x={x + 58}
              y={y + 3}
              fontSize={7.5}
              fill={head ? LINE : MID}
              style={MONO}
            >
              {e.actor}
            </text>
            <text
              x={x + w - 8}
              y={y + 3}
              fontSize={7.5}
              fill={ink}
              textAnchor="end"
              style={MONO}
            >
              {num(e.quantity)}
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
      {Array.from({ length: future }, (_, i) => (
        <line
          key={i}
          x1={x}
          x2={x + w}
          y1={rowY(past + 1 + i) + 8}
          y2={rowY(past + 1 + i) + 8}
          stroke={RULE}
          strokeWidth={HAIR}
          {...DOTTED}
        />
      ))}
    </g>
  )
}
