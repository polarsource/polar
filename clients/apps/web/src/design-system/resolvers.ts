import type React from 'react'
import { theme } from './theme'
import type { BoxStyleProps, ResponsiveValue } from './types'
import type { BreakpointKey, SpacingToken, ColorToken, BorderRadiusToken, ShadowToken } from './theme'

// --- Helpers ---

function isResponsive<T>(value: ResponsiveValue<T>): value is Partial<Record<string, T>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toKebab(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

function px(v: number): string {
  return v === 0 ? '0' : `${v}px`
}

function sizeValue(v: string | number): string {
  return typeof v === 'number' ? px(v) : v
}

// --- Token transforms ---

function spacingCss(token: SpacingToken): string {
  return px(theme.spacing[token])
}

function colorCss(token: ColorToken): string {
  return theme.colors[token]
}

function radiusCss(token: BorderRadiusToken): string {
  return px(theme.borderRadii[token])
}

function shadowCss(token: ShadowToken): string {
  return theme.shadows[token]
}

// --- Flex/grid value maps ---

const ALIGN_MAP: Record<string, string> = {
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  baseline: 'baseline',
  stretch: 'stretch',
  auto: 'auto',
}

const JUSTIFY_MAP: Record<string, string> = {
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
  stretch: 'stretch',
}

// --- Style prop keys (for separating style props from DOM props) ---

export const BOX_STYLE_PROP_KEYS = new Set<string>([
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'paddingHorizontal', 'paddingVertical',
  'p', 'pt', 'pr', 'pb', 'pl', 'px', 'py',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'marginHorizontal', 'marginVertical',
  'm', 'mt', 'mr', 'mb', 'ml', 'mx', 'my',
  'gap', 'rowGap', 'columnGap', 'g',
  'backgroundColor', 'color', 'borderColor',
  'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
  'borderBottomLeftRadius', 'borderBottomRightRadius',
  'borderWidth', 'borderTopWidth', 'borderRightWidth',
  'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
  'boxShadow',
  'display', 'overflow', 'overflowX', 'overflowY',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'aspectRatio',
  'flex', 'flexDirection', 'flexWrap', 'flexGrow', 'flexShrink', 'flexBasis',
  'alignItems', 'alignSelf', 'justifyContent', 'alignContent',
  'gridTemplateColumns', 'gridTemplateRows', 'gridColumn', 'gridRow',
  'gridAutoFlow', 'gridAutoColumns', 'gridAutoRows',
  'position', 'top', 'right', 'bottom', 'left', 'inset', 'zIndex',
  'opacity', 'cursor', 'pointerEvents', 'visibility', 'userSelect',
])

// --- Main resolver ---

export interface ResolvedStyles {
  style: React.CSSProperties
  responsiveCSS: string | null
}

export function resolveBoxStyles(props: BoxStyleProps, scopeClass: string): ResolvedStyles {
  const style: Record<string, string | number> = {}
  const breakpointStyles: Record<number, Record<string, string | number>> = {}

  function addProp<T>(
    cssProp: string,
    value: ResponsiveValue<T> | undefined,
    transform: (v: T) => string | number,
  ) {
    if (value === undefined) return

    if (isResponsive(value)) {
      for (const [bp, v] of Object.entries(value)) {
        if (v === undefined) continue
        const cssValue = transform(v as T)
        if (bp === 'base') {
          style[cssProp] = cssValue
        } else {
          const bpPx = theme.breakpoints[bp as BreakpointKey]
          if (bpPx !== undefined) {
            if (!breakpointStyles[bpPx]) breakpointStyles[bpPx] = {}
            breakpointStyles[bpPx][cssProp] = cssValue
          }
        }
      }
    } else {
      style[cssProp] = transform(value as T)
    }
  }

  // --- Spacing ---
  // Shorthands first, then longhands override
  addProp('padding', props.padding ?? props.p, spacingCss)
  addProp('paddingTop', props.paddingTop ?? props.pt, spacingCss)
  addProp('paddingRight', props.paddingRight ?? props.pr, spacingCss)
  addProp('paddingBottom', props.paddingBottom ?? props.pb, spacingCss)
  addProp('paddingLeft', props.paddingLeft ?? props.pl, spacingCss)
  addProp('paddingInline', props.paddingHorizontal ?? props.px, spacingCss)
  addProp('paddingBlock', props.paddingVertical ?? props.py, spacingCss)

  addProp('margin', props.margin ?? props.m, spacingCss)
  addProp('marginTop', props.marginTop ?? props.mt, spacingCss)
  addProp('marginRight', props.marginRight ?? props.mr, spacingCss)
  addProp('marginBottom', props.marginBottom ?? props.mb, spacingCss)
  addProp('marginLeft', props.marginLeft ?? props.ml, spacingCss)
  addProp('marginInline', props.marginHorizontal ?? props.mx, spacingCss)
  addProp('marginBlock', props.marginVertical ?? props.my, spacingCss)

  addProp('gap', props.gap ?? props.g, spacingCss)
  addProp('rowGap', props.rowGap, spacingCss)
  addProp('columnGap', props.columnGap, spacingCss)

  // --- Colors ---
  addProp('backgroundColor', props.backgroundColor, colorCss)
  addProp('color', props.color, colorCss)
  addProp('borderColor', props.borderColor, colorCss)

  // --- Border ---
  addProp('borderRadius', props.borderRadius, radiusCss)
  addProp('borderTopLeftRadius', props.borderTopLeftRadius, radiusCss)
  addProp('borderTopRightRadius', props.borderTopRightRadius, radiusCss)
  addProp('borderBottomLeftRadius', props.borderBottomLeftRadius, radiusCss)
  addProp('borderBottomRightRadius', props.borderBottomRightRadius, radiusCss)
  addProp('borderWidth', props.borderWidth, px)
  addProp('borderTopWidth', props.borderTopWidth, px)
  addProp('borderRightWidth', props.borderRightWidth, px)
  addProp('borderBottomWidth', props.borderBottomWidth, px)
  addProp('borderLeftWidth', props.borderLeftWidth, px)
  addProp('borderStyle', props.borderStyle, (v) => v)

  // --- Shadow ---
  addProp('boxShadow', props.boxShadow, shadowCss)

  // --- Layout ---
  addProp('display', props.display, (v) => v)
  addProp('overflow', props.overflow, (v) => v)
  addProp('overflowX', props.overflowX, (v) => v)
  addProp('overflowY', props.overflowY, (v) => v)
  addProp('width', props.width, sizeValue)
  addProp('height', props.height, sizeValue)
  addProp('minWidth', props.minWidth, sizeValue)
  addProp('maxWidth', props.maxWidth, sizeValue)
  addProp('minHeight', props.minHeight, sizeValue)
  addProp('maxHeight', props.maxHeight, sizeValue)
  addProp('aspectRatio', props.aspectRatio, (v) => v)

  // --- Flex ---
  addProp('flex', props.flex, (v) => (typeof v === 'number' ? `${v} ${v} 0%` : v))
  addProp('flexDirection', props.flexDirection, (v) => v)
  addProp('flexWrap', props.flexWrap, (v) => v)
  addProp('flexGrow', props.flexGrow, (v) => v)
  addProp('flexShrink', props.flexShrink, (v) => v)
  addProp('flexBasis', props.flexBasis, sizeValue)
  addProp('alignItems', props.alignItems, (v) => ALIGN_MAP[v] ?? v)
  addProp('alignSelf', props.alignSelf, (v) => ALIGN_MAP[v] ?? v)
  addProp('justifyContent', props.justifyContent, (v) => JUSTIFY_MAP[v] ?? v)
  addProp('alignContent', props.alignContent, (v) => JUSTIFY_MAP[v] ?? v)

  // --- Grid ---
  addProp('gridTemplateColumns', props.gridTemplateColumns, (v) => v)
  addProp('gridTemplateRows', props.gridTemplateRows, (v) => v)
  addProp('gridColumn', props.gridColumn, (v) => v)
  addProp('gridRow', props.gridRow, (v) => v)
  addProp('gridAutoFlow', props.gridAutoFlow, (v) => v)
  addProp('gridAutoColumns', props.gridAutoColumns, (v) => v)
  addProp('gridAutoRows', props.gridAutoRows, (v) => v)

  // --- Position ---
  addProp('position', props.position, (v) => v)
  addProp('top', props.top, sizeValue)
  addProp('right', props.right, sizeValue)
  addProp('bottom', props.bottom, sizeValue)
  addProp('left', props.left, sizeValue)
  addProp('inset', props.inset, sizeValue)
  addProp('zIndex', props.zIndex, (v) => v)

  // --- Visual ---
  addProp('opacity', props.opacity, (v) => v)
  addProp('cursor', props.cursor, (v) => v)
  addProp('pointerEvents', props.pointerEvents, (v) => v)
  addProp('visibility', props.visibility, (v) => v)
  addProp('userSelect', props.userSelect, (v) => v)

  // --- Build responsive CSS ---
  const bpKeys = Object.keys(breakpointStyles).map(Number).sort((a, b) => a - b)
  let responsiveCSS: string | null = null

  if (bpKeys.length > 0) {
    responsiveCSS = bpKeys
      .map((bp) => {
        const props = Object.entries(breakpointStyles[bp])
          .map(([k, v]) => `${toKebab(k)}: ${v}`)
          .join('; ')
        return `@media (min-width: ${bp}px) { .${scopeClass} { ${props} } }`
      })
      .join(' ')
  }

  return { style: style as React.CSSProperties, responsiveCSS }
}
