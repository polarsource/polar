import { MONO } from '../sheet'
import { LINE, DIM, MID, BG, HAIR, DOTTED } from '../kit'
import { useSim, type SimEvent } from '../simulation'

const properties = (e: SimEvent) => {
  switch (e.name) {
    case 'tokens.in':
    case 'tokens.out':
      return `{ tokens: ${e.quantity}, model: "…" }`
    case 'image.gen':
      return `{ count: ${e.quantity}, size: "1024" }`
    case 'api.call':
      return `{ route: "/v1/runs", status: 200 }`
    case 'credit.granted':
      return `{ credits: ${e.quantity} }`
  }
}

/** The event page, running: the frame is the latest event on the ledger, field by field. */
export function LiveEventFields({
  x,
  top,
  rh,
  cw,
}: {
  x: number
  top: number
  rh: number
  cw: number
}) {
  const e = useSim((s) => s.events[s.events.length - 1])
  if (!e) return null
  const stamp = new Date(e.at).toISOString().slice(0, 19) + 'Z'
  const rows: {
    cells: { span: number; name: string; value: string; open?: boolean }[]
  }[] = [
    { cells: [{ span: 32, name: 'ID', value: e.id }] },
    { cells: [{ span: 32, name: 'TIMESTAMP', value: stamp }] },
    {
      cells: [
        { span: 16, name: 'CUSTOMER', value: e.customer },
        { span: 16, name: 'ACTOR', value: e.actor },
      ],
    },
    { cells: [{ span: 32, name: 'NAME', value: e.name }] },
    {
      cells: [
        { span: 32, name: 'PROPERTIES', value: properties(e), open: true },
      ],
    },
  ]
  return (
    <g data-live>
      {rows.map((r, ri) => {
        let cx = x
        const y = top + rh * ri
        return r.cells.map((c, ci) => {
          const cxx = cx
          cx += c.span * cw
          const last = ri === rows.length - 1
          return (
            <g key={`${ri}-${ci}`}>
              <rect
                x={cxx}
                y={y}
                width={c.span * cw}
                height={rh}
                fill={BG}
                stroke={c.open ? DIM : last ? LINE : MID}
                strokeWidth={HAIR}
                {...(c.open ? DOTTED : {})}
              />
              <text
                x={cxx + 8}
                y={y + 11}
                fontSize={7.5}
                fill={c.open ? LINE : DIM}
                style={MONO}
              >
                {c.name}
              </text>
              <text
                key={e.id}
                x={cxx + 8}
                y={y + 22}
                fontSize={7.5}
                fill={c.open ? LINE : MID}
                style={{
                  ...MONO,
                  letterSpacing: 0,
                  animation: 'fg-appear 400ms both',
                }}
              >
                {c.value}
              </text>
            </g>
          )
        })
      })}
    </g>
  )
}
