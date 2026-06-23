// ─── Value Tokens (Tier 1 — Primitives) ───────────────────────────────────────
// Raw, context-free values. This is the ONLY tier where literal colors, sizes
// and font definitions live. Nothing here encodes intent — `gray500` is just a
// color, not "secondary text". Semantic (decision) tokens in semantics.stylex.ts
// reference these; never consume them directly in components.
//
// The neutral ramps (`gray*` light, `polar*` dark) are the canonical Polar
// scale, kept in lockstep with apps/web/src/styles/globals.css `@theme`. Treat
// that file and this one as the same ramp expressed in two systems.
//
// NOTE: Updating these requires a cache removal (rm -rf clients/apps/web/.next)
// and restarting the dev server.
// ──────────────────────────────────────────────────────────────────────────────

import * as stylex from '@stylexjs/stylex'

// ─── Color Palette ────────────────────────────────────────────────────────────

export const palette = stylex.defineVars({
  white: '#ffffff',
  black: '#000000',

  // Light-mode neutrals (cool gray ramp).
  gray50: 'oklch(0.985 0.002 247.839)',
  gray100: 'oklch(0.967 0.003 264.542)',
  gray200: 'oklch(0.928 0.006 264.531)',
  gray300: 'oklch(0.872 0.01 258.338)',
  gray400: 'oklch(0.707 0.022 261.325)',
  gray500: 'oklch(0.551 0.027 264.364)',
  gray600: 'oklch(0.446 0.03 256.802)',
  gray700: 'oklch(0.373 0.034 259.733)',
  gray800: 'oklch(0.278 0.033 256.848)',
  gray900: 'oklch(0.21 0.034 264.665)',
  gray950: 'oklch(0.13 0.028 261.692)',

  // Dark-mode neutrals (the Polar dark ramp).
  polar50: 'hsl(233, 4%, 85%)',
  polar100: 'hsl(233, 4%, 79%)',
  polar200: 'hsl(233, 4%, 68%)',
  polar300: 'hsl(233, 4%, 62%)',
  polar400: 'hsl(233, 4%, 52%)',
  polar500: 'hsl(233, 4%, 46%)',
  polar600: 'hsl(233, 4%, 22%)',
  polar700: 'hsl(233, 4%, 12%)',
  polar800: 'hsl(233, 4%, 9.5%)',
  polar900: 'hsl(233, 4%, 6.5%)',
  polar950: 'hsl(233, 4%, 3.5%)',

  // Emerald — success.
  emerald50: 'oklch(0.979 0.021 166.113)',
  emerald100: 'oklch(0.95 0.052 163.051)',
  emerald200: 'oklch(0.905 0.093 164.15)',
  emerald300: 'oklch(0.845 0.143 164.978)',
  emerald400: 'oklch(0.765 0.177 163.223)',
  emerald500: 'oklch(0.696 0.17 162.48)',
  emerald600: 'oklch(0.596 0.145 163.225)',
  emerald700: 'oklch(0.508 0.118 165.612)',
  emerald800: 'oklch(0.432 0.095 166.913)',
  emerald900: 'oklch(0.378 0.077 168.94)',
  emerald950: 'oklch(0.262 0.051 172.552)',

  // Red — danger.
  red50: 'oklch(0.971 0.013 17.38)',
  red100: 'oklch(0.936 0.032 17.717)',
  red200: 'oklch(0.885 0.062 18.334)',
  red300: 'oklch(0.808 0.114 19.571)',
  red400: 'oklch(0.704 0.191 22.216)',
  red500: 'oklch(0.637 0.237 25.331)',
  red600: 'oklch(0.577 0.245 27.325)',
  red700: 'oklch(0.505 0.213 27.518)',
  red800: 'oklch(0.444 0.177 26.899)',
  red900: 'oklch(0.396 0.141 25.723)',
  red950: 'oklch(0.258 0.092 26.042)',

  // Amber — warning.
  amber50: 'oklch(0.987 0.022 95.277)',
  amber100: 'oklch(0.962 0.059 95.617)',
  amber200: 'oklch(0.924 0.12 95.746)',
  amber300: 'oklch(0.879 0.169 91.605)',
  amber400: 'oklch(0.828 0.189 84.429)',
  amber500: 'oklch(0.769 0.188 70.08)',
  amber600: 'oklch(0.666 0.179 58.318)',
  amber700: 'oklch(0.555 0.163 48.998)',
  amber800: 'oklch(0.473 0.137 46.201)',
  amber900: 'oklch(0.414 0.112 45.904)',
  amber950: 'oklch(0.279 0.077 45.635)',

  // Indigo — accent / brand / info.
  indigo50: 'oklch(0.962 0.018 272.314)',
  indigo100: 'oklch(0.93 0.034 272.788)',
  indigo200: 'oklch(0.87 0.065 274.039)',
  indigo300: 'oklch(0.785 0.115 274.713)',
  indigo400: 'oklch(0.673 0.182 276.935)',
  indigo500: 'oklch(0.585 0.233 277.117)',
  indigo600: 'oklch(0.511 0.262 276.966)',
  indigo700: 'oklch(0.457 0.24 277.023)',
  indigo800: 'oklch(0.398 0.195 277.366)',
  indigo900: 'oklch(0.359 0.144 278.697)',
  indigo950: 'oklch(0.257 0.09 281.288)',
} as const)

// ─── Type Scale ───────────────────────────────────────────────────────────────
// `fontSizes` is a numeric ramp (1 = smallest). The px column is the reference
// rendering at the browser default root size.
// ──────────────────────────────────────────────────────────────────────────────

export const fontSizes = stylex.defineVars({
  1: '0.75rem', // 12
  2: '0.875rem', // 14
  3: '1rem', // 16
  4: '1.125rem', // 18
  5: '1.25rem', // 20
  6: '1.5rem', // 24
  7: '1.875rem', // 30
  8: '2.25rem', // 36
  9: '3rem', // 48
  10: '3.75rem', // 60
  11: '4.5rem', // 72
  12: '6rem', // 96
} as const)

export const lineHeights = stylex.defineVars({
  none: '1',
  tight: '1.25',
  snug: '1.375',
  normal: '1.5',
  relaxed: '1.625',
} as const)

export const fontWeights = stylex.defineVars({
  regular: '400',
  medium: '500',
  semibold: '600',
} as const)

export const letterSpacings = stylex.defineVars({
  tight: '-0.02em',
  normal: '0',
  wide: '0.025em',
} as const)

export const fontFamilies = stylex.defineVars({
  sans: "'Inter', sans-serif",
  display: "'InterDisplay', sans-serif",
  mono: "'GeistMono', monospace",
} as const)

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const spacing = stylex.defineVars({
  none: '0',
  xs: '4px',
  s: '8px',
  m: '12px',
  l: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
  '4xl': '64px',
  '5xl': '96px',
} as const)

// ─── Border Radius ────────────────────────────────────────────────────────────

export const borderRadii = stylex.defineVars({
  none: '0',
  s: '8px',
  m: '12px',
  l: '16px',
  xl: '32px',
  full: '9999px',
} as const)

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const shadows = stylex.defineVars({
  none: 'none',
  s: '0 1px 2px rgba(0, 0, 0, 0.05)',
  m: '0 0px 15px rgba(0, 0, 0, 0.04), 0 0px 2px rgba(0, 0, 0, 0.06)',
  l: '0 0px 20px rgba(0, 0, 0, 0.04), 0 0px 5px rgba(0, 0, 0, 0.06)',
  xl: '0 0px 30px rgba(0, 0, 0, 0.04), 0 0px 10px rgba(0, 0, 0, 0.06)',
} as const)

// ─── Breakpoints ──────────────────────────────────────────────────────────────

export const breakpoints = stylex.defineConsts({
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const)

// ─── Motion ───────────────────────────────────────────────────────────────────
// Durations are vars so motion can be globally tuned (or zeroed for
// prefers-reduced-motion) by overriding the custom properties. Easings are
// compile-time constants — they never need to vary at runtime.
// ──────────────────────────────────────────────────────────────────────────────

export const durations = stylex.defineVars({
  instant: '0ms',
  fast: '120ms',
  base: '200ms',
  slow: '320ms',
  slower: '480ms',
} as const)

export const easings = stylex.defineConsts({
  standard: 'cubic-bezier(0.2, 0, 0, 1)', // general-purpose, symmetric
  decelerate: 'cubic-bezier(0, 0, 0, 1)', // enter (fast → settle)
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)', // exit (settle → fast)
  spring: 'cubic-bezier(0.5, 1.25, 0.4, 1)', // slight overshoot
} as const)

// ─── Types ────────────────────────────────────────────────────────────────────

type StyleXTokenKeys<T> = Exclude<
  keyof T,
  '__opaqueId' | '__tokens' | symbol | 'toString' | 'valueOf' | 'description'
>

export type PaletteToken = StyleXTokenKeys<typeof palette>
export type FontSizeToken = StyleXTokenKeys<typeof fontSizes>
export type LineHeightToken = StyleXTokenKeys<typeof lineHeights>
export type FontWeightToken = StyleXTokenKeys<typeof fontWeights>
export type LetterSpacingToken = StyleXTokenKeys<typeof letterSpacings>
export type FontFamilyToken = StyleXTokenKeys<typeof fontFamilies>
export type SpacingToken = StyleXTokenKeys<typeof spacing>
export type BorderRadiusToken = StyleXTokenKeys<typeof borderRadii>
export type ShadowToken = StyleXTokenKeys<typeof shadows>
export type BreakpointKey = keyof typeof breakpoints
export type DurationToken = StyleXTokenKeys<typeof durations>
export type EasingToken = keyof typeof easings
