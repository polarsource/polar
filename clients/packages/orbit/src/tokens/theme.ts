import { tokens } from './vars'

export type OrbitColor = Extract<keyof typeof tokens, `COLOR_${string}`>
export type OrbitSpacing = Extract<keyof typeof tokens, `SPACING_${string}`>
export type OrbitRadius = Extract<keyof typeof tokens, `RADII_${string}`>
