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
  m: '12px',
  l: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
  '4xl': '64px',
  '5xl': '96px',
})

// ─── Colors ───────────────────────────────────────────────────────────────────
// Light values are the default. Dark values are applied via prefers-color-scheme.
// ──────────────────────────────────────────────────────────────────────────────

const DARK = '@media (prefers-color-scheme: dark)'

export const colors = stylex.defineVars({
  // Backgrounds
  'background-primary': {
    default: '#ffffff',
    [DARK]: 'hsl(233, 4%, 3.5%)',
  },
  'background-secondary': {
    default: 'oklch(0.985 0.002 247.839)',
    [DARK]: 'hsl(233, 4%, 6.5%)',
  },
  'background-card': {
    default: 'oklch(96.7% 0.003 264.54)',
    [DARK]: 'hsl(233, 4%, 9.5%)',
  },
  'background-warning': {
    default: 'oklch(0.97 0.026 102.5)',
    [DARK]: 'oklch(0.445 0.1 82.5 / 0.2)',
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
  'text-tertiary': {
    default: 'oklch(0.707 0.022 261.325)',
    [DARK]: 'hsl(233, 4%, 46%)',
  },

  // Borders
  'border-primary': {
    default: 'oklch(0.928 0.006 264.531)',
    [DARK]: 'hsl(233, 4%, 12%)',
  },
  'border-secondary': {
    default: 'oklch(0.928 0.006 264.531)',
    [DARK]: 'oklch(0.206 0.005 279.9)',
  },
  'border-warning': {
    default: 'oklch(0.836 0.138 100)',
    [DARK]: 'oklch(0.572 0.14 91)',
  },
})

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

type StyleXTokenKeys<T> = Exclude<
  keyof T,
  '__opaqueId' | '__tokens' | symbol | 'toString' | 'valueOf' | 'description'
>

export type SpacingToken = StyleXTokenKeys<typeof spacing>
export type ColorToken = StyleXTokenKeys<typeof colors>
export type BorderRadiusToken = StyleXTokenKeys<typeof borderRadii>
export type ShadowToken = StyleXTokenKeys<typeof shadows>
export type BreakpointKey = keyof typeof breakpoints
