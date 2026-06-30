// ─── Semantic Tokens (Tier 2 — Decisions) ─────────────────────────────────────
// Intent-named tokens that resolve to Tier 1 primitives from value.stylex.ts.
// The defining trait of this tier: every value REFERENCES a primitive rather
// than holding a literal. Covers both colors (`light-dark()` pairs) and the
// typography roles `Text` speaks in (`body`, `heading-l`, …).
//
// NOTE: Updating these requires a cache removal (rm -rf clients/apps/web/.next)
// and restarting the dev server.
// ──────────────────────────────────────────────────────────────────────────────

import * as stylex from '@stylexjs/stylex'

import {
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  palette,
} from './value.stylex'

// ─── Colors ───────────────────────────────────────────────────────────────────
// Set with https://stylexjs.com/docs/learn/recipes/light-dark-themes/
// ──────────────────────────────────────────────────────────────────────────────

export const backgroundColors = stylex.defineVars({
  'background-primary': `light-dark(${palette.white}, ${palette.polar950})`,
  'background-secondary': `light-dark(${palette.gray50}, ${palette.polar900})`,
  'background-card': `light-dark(${palette.gray100}, ${palette.polar800})`,
  'background-inverse': `light-dark(${palette.gray900}, ${palette.white})`,
  'background-accent': `light-dark(${palette.indigo50}, ${palette.indigo950})`,
  'background-warning': `light-dark(${palette.amber50}, ${palette.amber950})`,
  'background-success': `light-dark(${palette.emerald50}, ${palette.emerald950})`,
  'background-danger': `light-dark(${palette.red50}, ${palette.red950})`,
} as const)

export const textColors = stylex.defineVars({
  'text-primary': `light-dark(${palette.black}, ${palette.white})`,
  'text-secondary': `light-dark(${palette.gray500}, ${palette.polar400})`,
  'text-tertiary': `light-dark(${palette.gray400}, ${palette.polar500})`,
  'text-disabled': `light-dark(${palette.gray300}, ${palette.polar600})`,
  'text-success': `light-dark(${palette.emerald500}, ${palette.emerald500})`,
  'text-danger': `light-dark(${palette.red500}, ${palette.red500})`,
  'text-warning': `light-dark(${palette.amber500}, ${palette.amber500})`,
  'text-accent': `light-dark(${palette.indigo500}, ${palette.indigo500})`,
} as const)

export const borderColors = stylex.defineVars({
  'border-primary': `light-dark(${palette.gray200}, ${palette.polar700})`,
  'border-secondary': `light-dark(${palette.gray100}, ${palette.polar800})`,
  'border-warning': `light-dark(${palette.amber300}, ${palette.amber700})`,
} as const)

// ─── Typography roles ─────────────────────────────────────────────────────────
// Responsive sizes use StyleX conditional values keyed on the `md` breakpoint
// (768px). Line-heights are unitless ratios, so they scale with the size.
// ──────────────────────────────────────────────────────────────────────────────

const md = '@media (min-width: 768px)'

export const textRoleStyles = stylex.create({
  default: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes[2],
    lineHeight: lineHeights.normal,
  },
  title: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes[2],
    lineHeight: lineHeights.normal,
    fontWeight: fontWeights.medium,
  },
  body: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes[3],
    lineHeight: lineHeights.normal,
  },
  label: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes[1],
    lineHeight: lineHeights.snug,
    fontWeight: fontWeights.medium,
  },
  caption: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes[1],
    lineHeight: lineHeights.snug,
  },
  'heading-2xl': {
    fontFamily: fontFamilies.display,
    fontSize: { default: fontSizes[10], [md]: fontSizes[12] },
    lineHeight: lineHeights.none,
    fontWeight: fontWeights.medium,
  },
  'heading-xl': {
    fontFamily: fontFamilies.display,
    fontSize: { default: fontSizes[9], [md]: fontSizes[11] },
    lineHeight: lineHeights.none,
    fontWeight: fontWeights.medium,
  },
  'heading-l': {
    fontFamily: fontFamilies.display,
    fontSize: { default: fontSizes[8], [md]: fontSizes[9] },
    lineHeight: lineHeights.tight,
    fontWeight: fontWeights.medium,
  },
  'heading-m': {
    fontFamily: fontFamilies.sans,
    fontSize: { default: fontSizes[7], [md]: fontSizes[8] },
    lineHeight: lineHeights.tight,
    fontWeight: fontWeights.medium,
  },
  'heading-s': {
    fontFamily: fontFamilies.sans,
    fontSize: { default: fontSizes[6], [md]: fontSizes[7] },
    lineHeight: lineHeights.snug,
    fontWeight: fontWeights.medium,
  },
  'heading-xs': {
    fontFamily: fontFamilies.sans,
    fontSize: { default: fontSizes[5], [md]: fontSizes[6] },
    lineHeight: lineHeights.snug,
    fontWeight: fontWeights.medium,
  },
  'heading-xxs': {
    fontFamily: fontFamilies.sans,
    fontSize: { default: fontSizes[4], [md]: fontSizes[5] },
    lineHeight: lineHeights.snug,
    fontWeight: fontWeights.medium,
  },
})

export const textColorStyles = stylex.create({
  default: { color: textColors['text-primary'] },
  muted: { color: textColors['text-secondary'] },
  disabled: { color: textColors['text-disabled'] },
  accent: { color: textColors['text-accent'] },
  danger: { color: textColors['text-danger'] },
  error: { color: textColors['text-danger'] },
  warning: { color: textColors['text-warning'] },
  success: { color: textColors['text-success'] },
  inverse: { color: `light-dark(${palette.white}, ${palette.black})` },
  white: { color: palette.white },
  black: { color: palette.black },
  inherit: {},
})

// ─── Types ────────────────────────────────────────────────────────────────────

type StyleXTokenKeys<T> = Exclude<
  keyof T,
  '__opaqueId' | '__tokens' | symbol | 'toString' | 'valueOf' | 'description'
>

export type BackgroundColorToken = StyleXTokenKeys<typeof backgroundColors>
export type TextColorToken = StyleXTokenKeys<typeof textColors>
export type BorderColorToken = StyleXTokenKeys<typeof borderColors>
export type ColorToken =
  | BackgroundColorToken
  | TextColorToken
  | BorderColorToken
