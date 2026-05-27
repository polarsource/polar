// ─── Design System Tokens ───────────────────────────────────────────────────────────────────
// NOTE: Updating these require a cache removal (rm -rf clients/apps/web/.next) and
// restarting the dev server.
// ──────────────────────────────────────────────────────────────────────────────

import * as stylex from '@stylexjs/stylex'

// ─── Type helpers ─────────────────────────────────────────────────────────────
// Pulled to the top so they can be used by the color palette guards below.
// ──────────────────────────────────────────────────────────────────────────────

type StyleXTokenKeys<T> = Exclude<
  keyof T,
  '__opaqueId' | '__tokens' | symbol | 'toString' | 'valueOf' | 'description'
>

/**
 * Shape a dark-theme override must satisfy: exactly the same keys as the
 * matching light palette, every one declared, no extras. Drift between
 * the `stylex.defineVars` palette and the `stylex.createTheme` override
 * becomes a compile-time error rather than a silent visual bug.
 */
type DarkOverrideOf<Palette> = {
  [K in StyleXTokenKeys<Palette>]: string
}

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
})

// ─── Colors ───────────────────────────────────────────────────────────────────
// Light values are the unconditional defaults in `defineVars`. The dark
// palette lives in the `dark*Theme` exports below and activates only when
// `<OrbitThemeBinder />` (or a caller-applied `stylex.props(...)` className)
// is in scope — i.e. when next-themes resolves to `dark`.
//
// One source of truth per palette; switching is React-driven via
// next-themes rather than `prefers-color-scheme`, so explicit user choice
// always wins on the dashboard and the landing pages can lock to dark.
// ──────────────────────────────────────────────────────────────────────────────

export const backgroundColors = stylex.defineVars({
  'background-primary': '#ffffff',
  'background-secondary': 'oklch(0.985 0.002 247.839)',
  'background-card': 'oklch(96.7% 0.003 264.54)',
  'background-inverse': 'oklch(0.21 0.034 264.665)',
  'background-warning': 'oklch(0.97 0.026 102.5)',
  'background-success': 'oklch(0.97 0.04 162)',
  'background-danger': 'oklch(0.97 0.04 25)',
  'background-pending': 'oklch(0.96 0.005 264)',
})

export const textColors = stylex.defineVars({
  'text-primary': '#000000',
  'text-secondary': 'oklch(0.551 0.027 264.364)',
  'text-tertiary': 'oklch(0.707 0.022 261.325)',
  'text-success': 'oklch(0.696 0.17 162)',
  'text-danger': 'oklch(0.637 0.237 25)',
  'text-warning': 'oklch(0.769 0.188 70)',
  'text-pending': 'oklch(0.65 0.02 264)',
})

export const borderColors = stylex.defineVars({
  'border-primary': 'oklch(0.928 0.006 264.531)',
  'border-secondary': '#f6f6f6',
  'border-warning': 'oklch(0.836 0.138 100)',
})

// ─── Dark theme overrides ─────────────────────────────────────────────────────
// Applied by `<OrbitThemeBinder />` when the active theme is `dark`. Keep
// each theme aligned to its corresponding `defineVars` block (same keys).
// ──────────────────────────────────────────────────────────────────────────────

export const darkBackgroundTheme = stylex.createTheme(backgroundColors, {
  'background-primary': 'hsl(233, 4%, 3.5%)',
  'background-secondary': 'hsl(233, 4%, 6.5%)',
  'background-card': 'hsl(233, 4%, 9.5%)',
  'background-inverse': 'oklch(1.000 0.000 263.3)',
  'background-warning': 'oklch(0.445 0.1 82.5 / 0.2)',
  'background-success': 'oklch(0.696 0.17 162 / 0.2)',
  'background-danger': 'oklch(0.637 0.237 25 / 0.2)',
  'background-pending': 'oklch(0.6 0.02 264 / 0.2)',
} satisfies DarkOverrideOf<typeof backgroundColors>)

export const darkTextTheme = stylex.createTheme(textColors, {
  'text-primary': '#ffffff',
  'text-secondary': 'oklch(0.599 0.020 279.8)',
  'text-tertiary': 'hsl(233, 4%, 46%)',
  'text-success': 'oklch(0.696 0.17 162)',
  'text-danger': 'oklch(0.637 0.237 25)',
  'text-warning': 'oklch(0.769 0.188 70)',
  'text-pending': 'oklch(0.7 0.02 264)',
} satisfies DarkOverrideOf<typeof textColors>)

export const darkBorderTheme = stylex.createTheme(borderColors, {
  'border-primary': 'hsl(233, 4%, 12%)',
  'border-secondary': 'oklch(0.206 0.005 279.9)',
  'border-warning': 'oklch(0.572 0.14 91)',
} satisfies DarkOverrideOf<typeof borderColors>)

// ─── Border Radius ────────────────────────────────────────────────────────────

export const borderRadii = stylex.defineVars({
  none: '0',
  s: '8px',
  m: '12px',
  l: '16px',
  xl: '32px',
  full: '9999px',
})

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const shadows = stylex.defineVars({
  none: 'none',
  s: '0 1px 2px rgba(0, 0, 0, 0.05)',
  m: '0 0px 15px rgba(0, 0, 0, 0.04), 0 0px 2px rgba(0, 0, 0, 0.06)',
  l: '0 0px 20px rgba(0, 0, 0, 0.04), 0 0px 5px rgba(0, 0, 0, 0.06)',
  xl: '0 0px 30px rgba(0, 0, 0, 0.04), 0 0px 10px rgba(0, 0, 0, 0.06)',
})

// ─── Breakpoints ──────────────────────────────────────────────────────────────

export const breakpoints = stylex.defineConsts({
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
})

// ─── Types ────────────────────────────────────────────────────────────────────
// `StyleXTokenKeys` is declared at the top of the file (used by the
// dark-theme drift guard).

export type SpacingToken = StyleXTokenKeys<typeof spacing>
export type BackgroundColorToken = StyleXTokenKeys<typeof backgroundColors>
export type TextColorToken = StyleXTokenKeys<typeof textColors>
export type BorderColorToken = StyleXTokenKeys<typeof borderColors>
export type ColorToken =
  | BackgroundColorToken
  | TextColorToken
  | BorderColorToken
export type BorderRadiusToken = StyleXTokenKeys<typeof borderRadii>
export type ShadowToken = StyleXTokenKeys<typeof shadows>
export type BreakpointKey = keyof typeof breakpoints
