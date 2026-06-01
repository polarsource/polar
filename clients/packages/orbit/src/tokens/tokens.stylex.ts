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
// Set with https://stylexjs.com/docs/learn/recipes/light-dark-themes/
// ──────────────────────────────────────────────────────────────────────────────

export const backgroundColors = stylex.defineVars({
  'background-primary': 'light-dark(#ffffff, hsl(233, 4%, 3.5%))',
  'background-secondary':
    'light-dark(oklch(0.985 0.002 247.839), hsl(233, 4%, 6.5%))',
  'background-card':
    'light-dark(oklch(96.7% 0.003 264.54), hsl(233, 4%, 9.5%))',
  'background-inverse':
    'light-dark(oklch(0.21 0.034 264.665), oklch(1.000 0.000 263.3))',
  'background-warning':
    'light-dark(oklch(0.97 0.026 102.5), oklch(0.445 0.1 82.5 / 0.2))',
  'background-success':
    'light-dark(oklch(0.97 0.04 162), oklch(0.696 0.17 162 / 0.2))',
  'background-danger':
    'light-dark(oklch(0.97 0.04 25), oklch(0.637 0.237 25 / 0.2))',
  'background-pending':
    'light-dark(oklch(0.96 0.005 264), oklch(0.6 0.02 264 / 0.2))',
  'background-card-raised': 'light-dark(transparent, hsl(233, 4%, 9.5%))',
})

export const textColors = stylex.defineVars({
  'text-primary': 'light-dark(#000000, #ffffff)',
  'text-secondary':
    'light-dark(oklch(0.551 0.027 264.364), oklch(0.599 0.020 279.8))',
  'text-tertiary': 'light-dark(oklch(0.707 0.022 261.325), hsl(233, 4%, 46%))',
  'text-success': 'light-dark(oklch(0.696 0.17 162), oklch(0.696 0.17 162))',
  'text-danger': 'light-dark(oklch(0.637 0.237 25), oklch(0.637 0.237 25))',
  'text-warning': 'light-dark(oklch(0.769 0.188 70), oklch(0.769 0.188 70))',
  'text-pending': 'light-dark(oklch(0.65 0.02 264), oklch(0.7 0.02 264))',
})

export const borderColors = stylex.defineVars({
  'border-primary': 'light-dark(oklch(0.928 0.006 264.531), hsl(233, 4%, 12%))',
  'border-secondary': 'light-dark(#f6f6f6, oklch(0.206 0.005 279.9))',
  'border-warning': 'light-dark(oklch(0.836 0.138 100), oklch(0.572 0.14 91))',
  'border-card': 'light-dark(oklch(0.928 0.006 264.531), transparent)',
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
