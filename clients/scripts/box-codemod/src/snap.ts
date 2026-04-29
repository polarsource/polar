import type { ElementReport } from './types.ts'

export const SPACING_TOKENS = [
  ['none', 0],
  ['xs', 4],
  ['s', 8],
  ['m', 12],
  ['l', 16],
  ['xl', 24],
  ['2xl', 32],
  ['3xl', 48],
  ['4xl', 64],
  ['5xl', 96],
] as const

export type SpacingToken = (typeof SPACING_TOKENS)[number][0]

export function snapSpacing(px: number): {
  token: SpacingToken
  drift: number
  ambiguous: boolean
} {
  let best: SpacingToken = 'none'
  let bestDist = Infinity
  let bestValue = 0
  let tied = false

  for (const [token, value] of SPACING_TOKENS) {
    const dist = Math.abs(px - value)
    if (dist < bestDist) {
      best = token
      bestDist = dist
      bestValue = value
      tied = false
    } else if (dist === bestDist) {
      tied = true
      // prefer larger on tie
      if (value > bestValue) {
        best = token
        bestValue = value
      }
    }
  }

  return { token: best, drift: bestDist, ambiguous: tied }
}

export const RADIUS_TOKENS = [
  ['none', 0],
  ['s', 8],
  ['m', 12],
  ['l', 16],
  ['xl', 32],
] as const

export type RadiusToken = (typeof RADIUS_TOKENS)[number][0] | 'full'

// Tailwind default rounded-* scale (in px)
export const TW_RADIUS_PX: Record<string, number> = {
  none: 0,
  sm: 2,
  '': 4, // "rounded"
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  '4xl': 32,
}

export function snapRadius(px: number): {
  token: RadiusToken
  ambiguous: boolean
} {
  let best: RadiusToken = 'none'
  let bestDist = Infinity
  let bestValue = 0
  let tied = false
  for (const [token, value] of RADIUS_TOKENS) {
    const dist = Math.abs(px - value)
    if (dist < bestDist) {
      best = token
      bestDist = dist
      bestValue = value
      tied = false
    } else if (dist === bestDist) {
      tied = true
      if (value > bestValue) {
        best = token
        bestValue = value
      }
    }
  }
  return { token: best, ambiguous: tied }
}

export function noteAmbiguity(report: ElementReport, raw: string): void {
  if (!report.ambiguous) report.ambiguous = []
  report.ambiguous.push(raw)
}
