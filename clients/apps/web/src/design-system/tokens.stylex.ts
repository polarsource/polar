// ─── Design System Tokens ───────────────────────────────────────────────────────────────────
// NOTE: Updating these require a cache removal (rm -rf clients/apps/web/.next) and
// restarting the dev server.
// ──────────────────────────────────────────────────────────────────────────────

import * as stylex from '@stylexjs/stylex'

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const spacing = stylex.defineVars({
  none: '0',
  xs: '4px',
  s: '8px',
  m: '16px',
  l: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
  '4xl': '96px',
})

// ─── Colors ───────────────────────────────────────────────────────────────────
// Light values are the default. Dark values are applied via prefers-color-scheme.
// ──────────────────────────────────────────────────────────────────────────────

const DARK = '@media (prefers-color-scheme: dark)'

export const colors = stylex.defineVars({
  // Backgrounds
  'background-primary': {
    default: 'red',
    [DARK]: 'blue',
  },
  'background-secondary': {
    default: 'oklch(0.967 0.003 264.542)',
    [DARK]: 'oklch(0.232 0.006 279.9)',
  },

  // Text
  'text-primary': {
    default: 'oklch(0.21 0.034 264.665)',
    [DARK]: 'oklch(1.000 0.000 263.3)',
  },
  'text-secondary': {
    default: 'oklch(0.551 0.027 264.364)',
    [DARK]: 'oklch(0.599 0.020 279.8)',
  },

  // Borders
  'border-primary': {
    default: 'oklch(0.928 0.006 264.531)',
    [DARK]: 'oklch(0.232 0.006 279.9)',
  },
  'border-secondary': {
    default: 'oklch(0.967 0.003 264.542)',
    [DARK]: 'oklch(0.206 0.005 279.9)',
  },
})

// ─── Border Radius ────────────────────────────────────────────────────────────

export const borderRadii = stylex.defineVars({
  none: '0',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '32px',
  full: '9999px',
})

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const shadows = stylex.defineVars({
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 0px 15px rgba(0, 0, 0, 0.04), 0 0px 2px rgba(0, 0, 0, 0.06)',
  lg: '0 0px 20px rgba(0, 0, 0, 0.04), 0 0px 5px rgba(0, 0, 0, 0.06)',
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

type StyleXTokenKeys<T> = Exclude<
  keyof T,
  '__opaqueId' | '__tokens' | symbol | 'toString' | 'valueOf' | 'description'
>

export type SpacingToken = StyleXTokenKeys<typeof spacing>
export type ColorToken = StyleXTokenKeys<typeof colors>
export type BorderRadiusToken = StyleXTokenKeys<typeof borderRadii>
export type ShadowToken = StyleXTokenKeys<typeof shadows>
export type BreakpointKey = keyof typeof breakpoints
