import {
  LOGO_MARK_RAYS_PATH,
  LOGO_MARK_ARC_PATH,
  LOGO_MARK_BOUNDS,
  LOGO_MARK_ARC_CIRCLE,
  LOGO_MARK_SIZE,
  LOGO_MARK_SOURCE_SCALE,
} from '../logo/geometry'
import { Sheet, MONO } from '../sheet'
import {
  LINE,
  DIM,
  FAINT,
  RULE,
  HAIR,
  DOTTED,
  TITLE,
  TEXT,
  Anchor,
  Cross,
  Grain,
} from '../kit'
import { parsePath, corners } from '../anchors'
import type { Piece } from './index'

/**
 * The cover: the mark as the film constructs it. The circle every tip lies on and the arc's circle in the quiet
 * tone, the axes as dotted guides with their angles, the mark's outline in Snow with a square anchor on every
 * corner, and two vertices named with their coordinates in the brand file's units. Drawn from the logo package.
 */

const W = 400,
  H = 560
const LIGHT = { ...MONO, fontWeight: 300 } as const

export const cover: Piece = {
  id: 'cover',
  title: 'Billing for the Intelligence Era: A Field Guide',
  kind: 'manual',
  note: 'The cover: the mark, constructed. Every tip on one circle; the arc on a second of the same radius.',
  w: W,
  h: H,
  cols: 1,
  render: () => {
    const s = 0.54
    const ox = 84,
      oy = 136
    const P = (x: number, y: number): [number, number] => [
      ox + x * s,
      oy + y * s,
    ]
    const hub = P(LOGO_MARK_BOUNDS.cx, LOGO_MARK_BOUNDS.cy)
    const arc = P(LOGO_MARK_ARC_CIRCLE.cx, LOGO_MARK_ARC_CIRCLE.cy)
    const r = LOGO_MARK_BOUNDS.r * s
    const anchors = [
      ...corners(parsePath(LOGO_MARK_RAYS_PATH)),
      ...corners(parsePath(LOGO_MARK_ARC_PATH)),
    ]
    const file = (v: number) => (v * LOGO_MARK_SOURCE_SCALE).toFixed(2)
    // V_05: the left tip of the upper horizontal ray; V_16: the arc's inner edge on the axis
    const named = [
      anchors.find((a) => a.x < 2 && a.y < LOGO_MARK_SIZE / 2) ?? anchors[0],
      anchors.find((a) => a.x > 205 && a.x < 215 && Math.abs(a.y - 155) < 20) ??
        anchors[anchors.length - 1],
    ]
    const reach = r * 1.55
    const axis = (deg: number) => {
      const a = (deg * Math.PI) / 180
      return [hub[0] + Math.cos(a) * reach, hub[1] + Math.sin(a) * reach] as [
        number,
        number,
      ]
    }
    return (
      <Sheet
        w={W}
        h={H}
        surface="night"
        unsigned
        title="Billing for the Intelligence Era: A Field Guide"
      >
        <text x={28} y={32} fontSize={7.5} fill={DIM} style={MONO}>
          FIG. 01 THE MARK
        </text>
        <line
          x1={28}
          x2={W - 28}
          y1={40}
          y2={40}
          stroke={RULE}
          strokeWidth={HAIR}
          {...DOTTED}
        />

        {/* the axes, dotted, with their angles */}
        {[90, 135, 180, 225, 270].map((deg) => {
          const end = axis(deg)
          const a = (deg * Math.PI) / 180
          const lx = hub[0] + Math.cos(a) * (reach + 12),
            ly = hub[1] + Math.sin(a) * (reach + 12)
          return (
            <g key={deg}>
              <line
                x1={hub[0]}
                y1={hub[1]}
                x2={end[0]}
                y2={end[1]}
                stroke={DIM}
                strokeWidth={HAIR}
                {...DOTTED}
              />
              <text
                x={lx}
                y={ly + 2.5}
                fontSize={7.5}
                fill={DIM}
                textAnchor="middle"
                style={LIGHT}
              >
                {deg}°
              </text>
            </g>
          )
        })}

        {/* the circles the mark is built on */}
        <circle
          cx={hub[0]}
          cy={hub[1]}
          r={r}
          fill="none"
          stroke={FAINT}
          strokeWidth={HAIR}
        />
        <circle
          cx={arc[0]}
          cy={arc[1]}
          r={r}
          fill="none"
          stroke={FAINT}
          strokeWidth={HAIR}
        />
        <Cross at={hub} size={4} color={DIM} />
        <Cross at={arc} size={4} color={DIM} />
        {[hub, arc].map((c, i) => (
          <text
            key={i}
            x={c[0] + r * 0.5 + 5}
            y={c[1] - r * 0.866 - 5}
            fontSize={7.5}
            fill={DIM}
            style={LIGHT}
          >
            r 155
          </text>
        ))}

        {/* the mark, as an outline, and its anchors */}
        <g
          transform={`translate(${ox} ${oy}) scale(${s})`}
          fill={LINE}
          stroke={LINE}
          strokeWidth={HAIR / s}
          strokeLinejoin="round"
        >
          <path d={LOGO_MARK_RAYS_PATH} />
          <path d={LOGO_MARK_ARC_PATH} />
        </g>
        {anchors.map((a, i) => (
          <Anchor key={i} at={P(a.x, a.y)} size={3.2} />
        ))}

        {/* two vertices, named: one above its point to the left, one below its point to the right */}
        {named.map((a, i) => {
          const p = P(a.x, a.y)
          const left = i === 0
          // V_05 above-left of its point; V_16 below the arc's lower tip, inside the right circle
          const x = left ? p[0] - 10 : p[0] + 30
          const y0 = left ? p[1] - 26 : p[1] + r * 0.74 + 22
          return (
            <g
              key={i}
              fontSize={7}
              style={LIGHT}
              textAnchor={left ? 'end' : 'start'}
            >
              <text x={x} y={y0} fill={LINE}>
                V_{left ? '05' : '16'}
              </text>
              <text x={x} y={y0 + 9} fill={DIM}>
                x / {file(a.x)}
              </text>
              <text x={x} y={y0 + 18} fill={DIM}>
                y / {file(a.y)}
              </text>
            </g>
          )
        })}

        {/* the title: three lines at 30 on 34, then the line beneath */}
        <text x={28} y={H - 140} fontSize={30} fill={LINE} style={TITLE}>
          Billing for the
        </text>
        <text x={28} y={H - 106} fontSize={30} fill={LINE} style={TITLE}>
          Intelligence Era
        </text>
        <text x={28} y={H - 72} fontSize={30} fill={DIM} style={TITLE}>
          A Field Guide
        </text>
        <text x={28} y={H - 44} fontSize={12.5} fill={DIM} style={TEXT}>
          How a billing system works
        </text>
        <text x={28} y={H - 27} fontSize={12.5} fill={DIM} style={TEXT}>
          when every number is derived from events.
        </text>
        <Grain w={W} h={H} id="grain-cover" />
      </Sheet>
    )
  },
}
