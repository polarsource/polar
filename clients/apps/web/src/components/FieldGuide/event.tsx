import { MONO } from './sheet'
import { LINE, DIM, MID, BG, HAIR } from './kit'

/** The event the page dissects. It is fixed: the page reads one event, not whichever arrived last. */
const EXAMPLE = {
  id: 'evt_01ja7q',
  stamp: '2026-10-18T14:02:11Z',
  customer: 'acme',
  actor: 'agent_ada',
  name: 'llm.completion',
  metadata: '{ input_tokens: 3120, output_tokens: 1240, … }',
}

/** The event page: one event, field by field, on a 32-column ruler. */
export function EventFields({
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
  const e = EXAMPLE
  const rows: {
    cells: { span: number; name: string; value: string; measure?: boolean }[]
  }[] = [
    { cells: [{ span: 32, name: 'ID', value: e.id }] },
    { cells: [{ span: 32, name: 'TIMESTAMP', value: e.stamp }] },
    {
      cells: [
        { span: 16, name: 'CUSTOMER', value: e.customer },
        { span: 16, name: 'ACTOR', value: e.actor },
      ],
    },
    { cells: [{ span: 32, name: 'NAME', value: e.name }] },
    {
      cells: [{ span: 32, name: 'METADATA', value: e.metadata, measure: true }],
    },
  ]
  return (
    <g>
      {rows.map((r, ri) => {
        let cx = x
        const y = top + rh * ri
        return r.cells.map((c, ci) => {
          const cxx = cx
          cx += c.span * cw
          return (
            <g key={`${ri}-${ci}`}>
              <rect
                x={cxx}
                y={y}
                width={c.span * cw}
                height={rh}
                fill={BG}
                stroke={MID}
                strokeWidth={HAIR}
              />
              <text
                x={cxx + 8}
                y={y + 11}
                fontSize={7.5}
                fill={c.measure ? LINE : DIM}
                style={MONO}
              >
                {c.name}
              </text>
              <text
                x={cxx + 8}
                y={y + 22}
                fontSize={7.5}
                fill={c.measure ? LINE : MID}
                style={{ ...MONO, letterSpacing: 0 }}
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
