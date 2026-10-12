import {
  LOGO_MARK_RAYS_PATH,
  LOGO_MARK_ARC_PATH,
  LOGO_MARK_BOUNDS,
  LOGO_MARK_ARC_CIRCLE,
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
} from '../kit'
import { parsePath, corners } from '../anchors'
import type { Piece } from './index'

/**
 * The cover: the mark as the film constructs it. The circle every tip lies on and the arc's circle in the quiet
 * tone, the axes as dotted guides with their angles, the mark's outline in Snow with a square anchor on every
 * corner. Drawn from the logo package.
 */

/** The sheet is landscape like every other page: the title at the left, the mark constructed at the right. */
const SW = 960,
  SH = 540
const PAD = 40
const LIGHT = { ...MONO, fontWeight: 300 } as const

export const cover: Piece = {
  id: 'cover',
  title: 'Billing for the Intelligence Era: The Manual',
  kind: 'manual',
  note: 'The cover: the mark, constructed. Every tip on one circle; the arc on a second of the same radius.',
  w: SW,
  h: SH,
  cols: 1,
  render: () => {
    const s = 0.56
    const ox = 640 - LOGO_MARK_BOUNDS.cx * s,
      oy = 290 - LOGO_MARK_BOUNDS.cy * s
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
        w={SW}
        h={SH}
        surface="night"
        unsigned
        title="Billing for the Intelligence Era: The Manual"
        pad={PAD}
      >
        <text x={PAD} y={PAD + 16} fontSize={8.5} fill={DIM} style={MONO}>
          POLAR · 2026
        </text>
        <text
          x={SW - PAD}
          y={PAD + 16}
          fontSize={8.5}
          fill={DIM}
          textAnchor="end"
          style={MONO}
        >
          THE MANUAL
        </text>
        <line
          x1={PAD}
          x2={SW - PAD}
          y1={PAD + 26}
          y2={PAD + 26}
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
                fontSize={8.5}
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
            fontSize={8.5}
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

        {/* the title: three lines at 40 on 46, then two lines beneath; up with the first stroke of the mark */}
        <g data-first>
          <text x={PAD} y={254} fontSize={40} fill={LINE} style={TITLE}>
            Billing for the
          </text>
          <text x={PAD} y={300} fontSize={40} fill={LINE} style={TITLE}>
            Intelligence Era
          </text>
          <text x={PAD} y={346} fontSize={40} fill={DIM} style={TITLE}>
            The Manual
          </text>
          <text x={PAD} y={392} fontSize={16} fill={DIM} style={TEXT}>
            The engineering behind the fastest
          </text>
          <text x={PAD} y={414} fontSize={16} fill={DIM} style={TEXT}>
            metering infrastructure for AI.
          </text>
        </g>
      </Sheet>
    )
  },
}
