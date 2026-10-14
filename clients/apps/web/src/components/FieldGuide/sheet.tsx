import type { ReactNode } from 'react'

/**
 * The sheet every page of the field guide is drawn on, and the parts pages share: the ink per surface, the mono
 * style, labels and lines of code. Every page is one SVG at a design size, so it scales exactly wherever it is shown.
 */

export type Surface = 'night' | 'snow' | 'ether'

export interface Ink {
  bg: string
  ink: string
  dim: string
  accent: string
  negative: string
  /** A faint rule or fill on this surface. */
  faint: string
}

const NIGHT = '#141414'
const SNOW = '#d8d8d8'
const MIST = '#7b7b7b'
const ETHER = '#3619CC'
const NEGATIVE = '#D0321F'

export const INK: Record<Surface, Ink> = {
  night: {
    bg: NIGHT,
    ink: SNOW,
    dim: MIST,
    accent: ETHER,
    negative: NEGATIVE,
    faint: 'rgba(216,216,216,0.12)',
  },
  snow: {
    bg: SNOW,
    ink: NIGHT,
    dim: MIST,
    accent: ETHER,
    negative: NEGATIVE,
    faint: 'rgba(9,9,9,0.12)',
  },
  ether: {
    bg: ETHER,
    ink: SNOW,
    dim: 'rgba(216,216,216,0.55)',
    accent: SNOW,
    negative: NEGATIVE,
    faint: 'rgba(216,216,216,0.18)',
  },
}

export const MONO = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 400,
  letterSpacing: '0.04em',
} as const

export interface SheetProps {
  w: number
  h: number
  surface: Surface
  /** Kept for the pages that pass it; the field guide signs nothing. */
  unsigned?: boolean
  /** An ink of its own, instead of the surface's. */
  ink?: Ink
  children?: ReactNode
  title?: string
  /** The page's inner margin; given, the sheet is cropped to it, so the page sits flat on whatever holds it. */
  pad?: number
}

export function Sheet({
  w,
  h,
  surface,
  ink: custom,
  children,
  title,
  pad,
}: SheetProps) {
  const ink = custom ?? INK[surface]
  // Cropped to the margin so the page sits flush with the text beside it; what is drawn on the margin line
  // itself still shows, as the sheet overflows.
  const viewBox = pad
    ? `${pad} ${pad} ${w - pad * 2} ${h - pad * 2}`
    : `0 0 ${w} ${h}`
  return (
    <svg
      viewBox={viewBox}
      width="100%"
      style={{
        display: 'block',
        overflow: 'visible',
        background: pad ? undefined : ink.bg,
      }}
      role="img"
      aria-label={title}
    >
      {children}
    </svg>
  )
}

export function Label({
  x,
  y,
  children,
  ink,
  size = 11.5,
  anchor = 'start',
  dim = true,
  color,
}: {
  x: number
  y: number
  children: ReactNode
  ink: Ink
  size?: number
  anchor?: 'start' | 'middle' | 'end'
  dim?: boolean
  color?: string
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fill={color ?? (dim ? ink.dim : ink.ink)}
      textAnchor={anchor}
      style={MONO}
    >
      {children}
    </text>
  )
}

/** Lines of mono, as in a terminal or a file. */
export function Code({
  x,
  y,
  lines,
  ink,
  size = 13,
  lh = 1.7,
}: {
  x: number
  y: number
  lines: readonly (string | { t: string; tone?: 'dim' | 'accent' })[]
  ink: Ink
  size?: number
  lh?: number
}) {
  return (
    <g style={{ ...MONO, letterSpacing: 0 }} fontSize={size}>
      {lines.map((l, i) => {
        const o = typeof l === 'string' ? { t: l } : l
        return (
          <text
            key={i}
            x={x}
            y={y + i * size * lh}
            fill={
              o.tone === 'dim'
                ? ink.dim
                : o.tone === 'accent'
                  ? ink.accent
                  : ink.ink
            }
            xmlSpace="preserve"
          >
            {o.t}
          </text>
        )
      })}
    </g>
  )
}
