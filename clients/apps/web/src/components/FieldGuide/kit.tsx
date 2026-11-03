import type { ReactNode } from 'react'
import { Label, MONO, INK, type Ink } from './sheet'

/**
 * The manual's drawing kit, drawn the way the rebrand film draws its constructions: Night under grain, Snow
 * hairlines, a small square anchor on every vertex, dotted guides, crosshairs, and light mono labels in Mist.
 * Isometric exploded views, callouts on leader lines, and figure frames with corner marks.
 */

export const NIGHT_INK: Ink = INK.night
/** Three tones of line. Snow is for the subject of a figure only; the rest of the drawing stays back. */
export const LINE = NIGHT_INK.ink
/** Construction and secondary geometry: the circle a thing is built on, the belt it sits on, the box beside it. */
export const MID = '#8f8f8f'
/** Guides, leaders and labels. */
export const DIM = NIGHT_INK.dim
export const BG = NIGHT_INK.bg
/** The film's dotted guide: dots, not dashes. */
export const DOTTED = {
  strokeDasharray: '0.1 2.8',
  strokeLinecap: 'round',
} as const
/** Every face is opaque Night: what is nearer simply hides what is behind it. Nothing is translucent. */
export const FILL = { top: BG, left: BG, right: BG, pale: BG }
/** Quiet greys for frames and rules, instead of opacity. */
export const FRAME = '#2a2a2a'
export const RULE = '#3a3a3a'
/** Construction geometry that should sit well behind the subject: fainter than Mist, still a line. */
export const FAINT = '#4a4a4a'
export const HAIR = 0.9
const LIGHT = { ...MONO, fontWeight: 300 } as const

/** Isometric projection: x runs down-right, y down-left, z up. */
export const iso = (
  x: number,
  y: number,
  z: number,
  s = 1,
  ox = 0,
  oy = 0,
): [number, number] => [
  ox + (x - y) * 0.866 * s,
  oy + (x + y) * 0.5 * s - z * s,
]

const pt = (p: [number, number]) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`

/** A small square anchor, as a drawing program shows an on-curve point. */
export function Anchor({
  at,
  size = 3.2,
}: {
  at: [number, number]
  size?: number
}) {
  return (
    <rect
      x={at[0] - size / 2}
      y={at[1] - size / 2}
      width={size}
      height={size}
      fill={BG}
      stroke={LINE}
      strokeWidth={0.8}
    />
  )
}

/** A crosshair at a centre. */
export function Cross({
  at,
  size = 5,
  color = LINE,
}: {
  at: [number, number]
  size?: number
  color?: string
}) {
  return (
    <path
      d={`M${at[0] - size} ${at[1]}h${size * 2}M${at[0]} ${at[1] - size}v${size * 2}`}
      stroke={color}
      strokeWidth={HAIR}
    />
  )
}

/** A box with its three visible faces, opaque; anchors on its vertices only when asked. */
export function IsoBox({
  x,
  y,
  z,
  w,
  d,
  h,
  s = 1,
  ox = 0,
  oy = 0,
  fill = FILL,
  tone = 'ink',
  stroke,
  dash,
  anchors,
}: {
  x: number
  y: number
  z: number
  w: number
  d: number
  h: number
  s?: number
  ox?: number
  oy?: number
  fill?: typeof FILL | null
  tone?: 'ink' | 'mid'
  stroke?: string
  dash?: string
  anchors?: boolean
}) {
  const col = stroke ?? (tone === 'mid' ? MID : LINE)
  const P = (a: number, b: number, c: number) => iso(a, b, c, s, ox, oy)
  const top = [
    P(x, y, z + h),
    P(x + w, y, z + h),
    P(x + w, y + d, z + h),
    P(x, y + d, z + h),
  ]
  const left = [
    P(x, y + d, z + h),
    P(x + w, y + d, z + h),
    P(x + w, y + d, z),
    P(x, y + d, z),
  ]
  const right = [
    P(x + w, y, z + h),
    P(x + w, y + d, z + h),
    P(x + w, y + d, z),
    P(x + w, y, z),
  ]
  const poly = (pts: [number, number][], f: string) => (
    <path
      d={`M${pts.map(pt).join('L')}Z`}
      fill={fill ? f : BG}
      stroke={col}
      strokeWidth={HAIR}
      strokeDasharray={dash}
      strokeLinejoin="round"
    />
  )
  const showAnchors = anchors ?? false
  const verts: [number, number][] = [
    top[0],
    top[1],
    top[2],
    top[3],
    left[2],
    left[3],
    right[3],
  ]
  return (
    <g>
      {poly(top, fill?.top ?? '')}
      {poly(left, fill?.left ?? '')}
      {poly(right, fill?.right ?? '')}
      {showAnchors
        ? verts.map((v) => <Anchor key={v.join(',')} at={v} />)
        : null}
    </g>
  )
}

/** A flat plate, for exploded stacks. */
export function IsoPlate(
  props: Omit<Parameters<typeof IsoBox>[0], 'h'> & { h?: number },
) {
  return <IsoBox {...props} h={props.h ?? 3} />
}

/**
 * An anchor on the drawing, a dotted leader with one elbow, and a light mono label in Mist. `route` is which way
 * the leader leaves the anchor: 'h' runs level first, 'v' runs up or down first, so it can clear the drawing.
 */
export function Callout({
  at,
  to,
  side = 'right',
  children,
  color = DIM,
  dot = true,
  route = 'h',
}: {
  at: [number, number]
  to: [number, number]
  side?: 'left' | 'right'
  children: ReactNode
  color?: string
  dot?: boolean
  route?: 'h' | 'v'
}) {
  const elbow: [number, number] =
    route === 'h' ? [to[0], at[1]] : [at[0], to[1]]
  const straight = Math.abs(to[1] - at[1]) < 1 || Math.abs(to[0] - at[0]) < 1
  const d = straight
    ? `M${pt(at)}L${pt(to)}`
    : `M${pt(at)}L${pt(elbow)}L${pt(to)}`
  // The leader is a dotted guide, like the construction lines. The square sits on the subject, or, for a label
  // that names a region rather than a point, at the label's end, where the text hangs from it.
  return (
    <g>
      <path d={d} fill="none" stroke={DIM} strokeWidth={HAIR} {...DOTTED} />
      <Anchor at={dot ? at : to} />
      <text
        x={to[0] + (side === 'right' ? 8 : -8)}
        y={to[1] + 2.5}
        fontSize={8.5}
        fill={color}
        textAnchor={side === 'right' ? 'start' : 'end'}
        style={MONO}
      >
        {children}
      </text>
    </g>
  )
}

/** A dotted guide between two points, in Mist, as the film draws its axes and construction lines. */
export function Guide({ a, b }: { a: [number, number]; b: [number, number] }) {
  return (
    <line
      x1={a[0]}
      y1={a[1]}
      x2={b[0]}
      y2={b[1]}
      stroke={DIM}
      strokeWidth={HAIR}
      {...DOTTED}
    />
  )
}

/** A dimension: a hairline with ticks at both ends and the measure beside its middle. */
export function Dimension({
  a,
  b,
  text,
  side = -10,
}: {
  a: [number, number]
  b: [number, number]
  text: string
  side?: number
}) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len,
    ny = dx / len
  const tick = 4
  const mx = (a[0] + b[0]) / 2 + nx * side,
    my = (a[1] + b[1]) / 2 + ny * side
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  return (
    <g stroke={MID} strokeWidth={HAIR}>
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      {[a, b].map((p, i) => (
        <line
          key={i}
          x1={p[0] - nx * tick}
          y1={p[1] - ny * tick}
          x2={p[0] + nx * tick}
          y2={p[1] + ny * tick}
        />
      ))}
      <text
        x={mx}
        y={my + 2}
        fontSize={8}
        fill={DIM}
        stroke="none"
        textAnchor={horizontal ? 'middle' : nx * side < 0 ? 'end' : 'start'}
        style={LIGHT}
      >
        {text}
      </text>
    </g>
  )
}

/** Room between a drawing and the top and bottom of its frame. */
export const FIGURE_PAD = 48

/** The four corner marks of a frame, as path data. */
export const frameCorners = (x: number, y: number, w: number, h: number) => {
  const c = 6
  return [
    `M${x} ${y + c}V${y}H${x + c}`,
    `M${x + w - c} ${y}H${x + w}V${y + c}`,
    `M${x + w} ${y + h - c}V${y + h}H${x + w - c}`,
    `M${x + c} ${y + h}H${x}V${y + h - c}`,
  ]
}

/**
 * A figure frame: a faint hairline box with corner marks, standing still while the drawing inside traces itself in.
 * It spans `x` to `x + w`; once the drawing is measured, the page centres it across that width and fits the frame's
 * height to it, `FIGURE_PAD` above and below, so no drawing is held to one aspect ratio. See `Plate`.
 */
export function Figure({
  x,
  y,
  w,
  h,
  children,
}: {
  x: number
  y: number
  w: number
  h: number
  children: ReactNode
}) {
  return (
    <g data-figure={`${x} ${y} ${w} ${h}`}>
      <g data-frame>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill="none"
          stroke={FRAME}
          strokeWidth={HAIR}
        />
        <g stroke={MID} strokeWidth={HAIR} fill="none">
          {frameCorners(x, y, w, h).map((d) => (
            <path key={d.slice(0, 12)} d={d} />
          ))}
        </g>
      </g>
      <g data-figure-content>{children}</g>
    </g>
  )
}

/** Display type, kerned: titles a touch tighter than text, nothing cramped. */
export const TITLE = {
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  letterSpacing: '-0.01em',
  fontKerning: 'normal',
  textRendering: 'optimizeLegibility',
} as const
export const TEXT = {
  fontFamily: 'var(--font-display)',
  fontWeight: 450,
  letterSpacing: '0',
  fontKerning: 'normal',
  textRendering: 'optimizeLegibility',
} as const

/** The foot: the page number, nothing else. */
export function PageFoot({
  w,
  h,
  pad = 28,
  page,
  ink = NIGHT_INK,
}: {
  w: number
  h: number
  pad?: number
  page: string
  title?: string
  ink?: Ink
}) {
  return (
    <Label x={w - pad} y={h - pad - 8} ink={ink} size={8.5} anchor="end">
      {page}
    </Label>
  )
}

/** A hatch for cut surfaces and levels. */
export function Hatch({ id = 'hatch' }: { id?: string }) {
  return (
    <defs>
      <pattern
        id={id}
        width={4}
        height={4}
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <line x1={0} y1={0} x2={0} y2={4} stroke={DIM} strokeWidth={0.5} />
      </pattern>
    </defs>
  )
}

/** The film's grain, laid over the whole sheet. */
export function Grain({
  w,
  h,
  id,
  amount = 0.09,
}: {
  w: number
  h: number
  id: string
  amount?: number
}) {
  return (
    <g pointerEvents="none">
      <filter id={id} x={0} y={0} width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves={2}
          stitchTiles="stitch"
        />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.85 0 0 0 0 0.85 0 0 0 0 0.85 0.33 0.33 0.33 0 0"
        />
      </filter>
      <rect width={w} height={h} filter={`url(#${id})`} opacity={amount} />
    </g>
  )
}

/* ------------------------------------------------------------ transcripts */

export type TermTone = 'ink' | 'dim' | 'inv' | 'add' | 'del'
/** The two colours a diff needs, and the only colour on these pages. */
export const ADD = '#34D399'
export const DEL = '#EF4444'
export interface TermTok {
  t: string
  tone?: TermTone
  /** Width in characters, when the text is not the width it should take. */
  w?: number
}

/**
 * A transcript set as typography: mono text on a character grid, `>>` markers in the gutter, thin bars beside
 * blocks, boxed sections, and inverted lines (Night on Snow) for what changed. `X`, `Y0` place the grid's origin.
 */
export function term(X: number, Y0: number, FS = 7.5, LH = 11.5) {
  // Geist Mono's advance is 0.6 em; its cap height sits at 0.71 em, so the middle of a capital is 0.355 em above the baseline.
  const CW = FS * 0.6
  const PAD = 2.5
  const line = (row: number, x: number, toks: TermTok[], key: string) => {
    const y = Y0 + row * LH
    let cx = X + x * CW
    return (
      <g key={key}>
        {toks.map((k, i) => {
          const w = (k.w ?? k.t.length) * CW
          const tw = k.t.length * CW
          const inv = k.tone === 'inv'
          const el = (
            <g key={i}>
              {inv ? (
                <rect
                  x={cx - PAD}
                  y={y - FS * 0.355 - (FS + 2 * PAD) / 2}
                  width={tw + 2 * PAD}
                  height={FS + 2 * PAD}
                  fill={LINE}
                />
              ) : null}
              <text
                x={inv ? cx + tw / 2 : cx}
                y={y}
                fontSize={FS}
                fill={
                  inv
                    ? BG
                    : k.tone === 'dim'
                      ? DIM
                      : k.tone === 'add'
                        ? ADD
                        : k.tone === 'del'
                          ? DEL
                          : LINE
                }
                textAnchor={inv ? 'middle' : 'start'}
                style={{ ...MONO, letterSpacing: 0 }}
                xmlSpace="preserve"
              >
                {k.t}
              </text>
            </g>
          )
          cx += w
          return el
        })}
      </g>
    )
  }
  const gutter = (row: number, x = -22) => (
    <text
      key={`g${row}`}
      x={X + x}
      y={Y0 + row * LH}
      fontSize={FS}
      fill={DIM}
      style={MONO}
    >
      {'>>'}
    </text>
  )
  const bar = (r0: number, r1: number, x = -6) => (
    <line
      key={`b${r0}-${x}`}
      x1={X + x * CW}
      x2={X + x * CW}
      y1={Y0 + r0 * LH - FS}
      y2={Y0 + r1 * LH + 3}
      stroke={MID}
      strokeWidth={HAIR}
    />
  )
  const box = (r0: number, r1: number, x0: number, x1: number) => (
    <rect
      key={`x${r0}`}
      x={X + x0 * CW - 4}
      y={Y0 + r0 * LH - FS - 1}
      width={(x1 - x0) * CW + 8}
      height={(r1 - r0) * LH + FS + 5}
      fill="none"
      stroke={MID}
      strokeWidth={HAIR}
    />
  )
  const dot = (row: number, x: number) => (
    <circle
      key={`d${row}-${x}`}
      cx={X + x * CW}
      cy={Y0 + row * LH - 2.5}
      r={0.9}
      fill={DIM}
    />
  )
  return { line, gutter, bar, box, dot, CW, LH }
}
