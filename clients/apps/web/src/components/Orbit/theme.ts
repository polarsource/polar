import type { ThemeSpec } from './utils/createBox'

// ─── Colors ───────────────────────────────────────────────────────────────────
// Values reference CSS custom properties defined in globals.css so dark mode
// is handled automatically via the .dark class on a parent element.

export const orbitColors = {
  bg: 'var(--orbit-bg)',
  'bg-surface': 'var(--orbit-bg-surface)',
  'bg-elevated': 'var(--orbit-bg-elevated)',
  text: 'var(--orbit-text)',
  'text-muted': 'var(--orbit-text-muted)',
  'text-subtle': 'var(--orbit-text-subtle)',
  destructive: 'var(--orbit-destructive)',
} as const satisfies Record<string, string>

// ─── Spacing ──────────────────────────────────────────────────────────────────
// Numeric keys mirror the --orbit-space-{n} token names.
// Values are rem equivalents of the documented pixel sizes.

export const orbitSpacing = {
  1: '0.5rem',  //   8px — icon gaps, tight padding
  2: '1rem',    //  16px — component inner padding
  3: '1.5rem',  //  24px — card padding
  4: '2rem',    //  32px — section internal gap
  6: '3rem',    //  48px — component section gap
  8: '4rem',    //  64px — page padding (mobile)
  12: '6rem',   //  96px — section spacing (mobile)
  16: '8rem',   // 128px — page padding (desktop)
  32: '16rem',  // 256px — section spacing (desktop)
} as const satisfies Record<number, string>

// ─── Radii ────────────────────────────────────────────────────────────────────

export const orbitRadii = {
  sm: '0.5rem',   //  8px
  md: '0.75rem',  // 12px
  lg: '1rem',     // 16px
  xl: '1.5rem',   // 24px
  '2xl': '2rem',  // 32px
  full: '9999px',
} as const satisfies Record<string, string>

// ─── Theme ────────────────────────────────────────────────────────────────────

export const orbitTheme = {
  colors: orbitColors,
  spacing: orbitSpacing,
  radii: orbitRadii,
} as const satisfies ThemeSpec

export type OrbitTheme = typeof orbitTheme
export type OrbitColor = keyof typeof orbitColors
export type OrbitSpacing = keyof typeof orbitSpacing
export type OrbitRadius = keyof typeof orbitRadii
