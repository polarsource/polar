import * as stylex from '@stylexjs/stylex'

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const spacing = stylex.defineVars({
  none: '0',
  xs: '4px',
  s: '8px',
  m: '16px',
  l: '24px',
  xl: '32px',
})

// ─── Colors ───────────────────────────────────────────────────────────────────
// Values reference CSS custom properties from tokens.css for light/dark mode.
// ──────────────────────────────────────────────────────────────────────────────

export const colors = stylex.defineVars({
  // Backgrounds
  'background-primary': 'var(--ds-background-primary)',
  'background-secondary': 'var(--ds-background-secondary)',

  // Colors
  'text-primary': 'var(--ds-text-primary)',
  'text-secondary': 'var(--ds-text-secondary)',

  // Borders
  'border-primary': 'var(--ds-border-primary)',
  'border-secondary': 'var(--ds-border-secondary)',
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

type StyleXTokenKeys<T> = Exclude<keyof T, '__opaqueId' | '__tokens' | symbol>

export type SpacingToken = StyleXTokenKeys<typeof spacing>
export type ColorToken = StyleXTokenKeys<typeof colors>
export type BorderRadiusToken = StyleXTokenKeys<typeof borderRadii>
export type ShadowToken = StyleXTokenKeys<typeof shadows>
export type BreakpointKey = keyof typeof breakpoints
