import * as stylex from '@stylexjs/stylex'
import type React from 'react'
import type {
  BorderRadiusToken,
  BreakpointKey,
  ColorToken,
  ShadowToken,
  SpacingToken,
} from '../tokens/tokens.stylex'
import {
  borderRadii,
  breakpoints,
  colors,
  shadows,
  spacing,
} from '../tokens/tokens.stylex'
import {
  alignContentStyles,
  alignItemsStyles,
  alignSelfStyles,
  backgroundColorStyles,
  borderBottomLeftRadiusStyles,
  borderBottomRightRadiusStyles,
  borderColorStyles,
  borderRadiusStyles,
  borderStyleStyles,
  borderTopLeftRadiusStyles,
  borderTopRightRadiusStyles,
  boxShadowStyles,
  colorStyles,
  columnGapStyles,
  cursorStyles,
  displayStyles,
  flexDirectionStyles,
  flexWrapStyles,
  gapStyles,
  gridAutoFlowStyles,
  justifyContentStyles,
  marginBlockStyles,
  marginBottomStyles,
  marginInlineStyles,
  marginLeftStyles,
  marginRightStyles,
  marginStyles,
  marginTopStyles,
  overflowStyles,
  overflowXStyles,
  overflowYStyles,
  paddingBlockStyles,
  paddingBottomStyles,
  paddingInlineStyles,
  paddingLeftStyles,
  paddingRightStyles,
  paddingStyles,
  paddingTopStyles,
  pointerEventsStyles,
  positionStyles,
  rowGapStyles,
  textAlignStyles,
  userSelectStyles,
  visibilityStyles,
} from './box-styles'
import type { BoxStyleProps, PseudoState, ResponsiveValue } from './types'

const PSEUDO_SELECTOR_MAP: Record<PseudoState, string> = {
  hover: ':hover',
  focus: ':focus',
  active: ':active',
  focusVisible: ':focus-visible',
  focusWithin: ':focus-within',
}

function isPseudoState(key: string): key is PseudoState {
  return key in PSEUDO_SELECTOR_MAP
}

// --- Helpers ---

function isResponsive<T>(
  value: ResponsiveValue<T>,
): value is Partial<Record<string, T>> {
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

// Token transforms — at runtime, defineVars values are CSS variable references (e.g. "var(--xhash)")
// which are valid CSS values for use in scoped responsive <style> tags.
function spacingCss(token: SpacingToken): string {
  return spacing[token] as string
}
function marginCss(token: SpacingToken | 'auto'): string {
  if (token === 'auto') return 'auto'
  return spacing[token] as string
}
function colorCss(token: ColorToken): string {
  return colors[token] as string
}
function radiusCss(token: BorderRadiusToken): string {
  return borderRadii[token] as string
}
function shadowCss(token: ShadowToken): string {
  return shadows[token] as string
}

const FLEX_KEYWORD_MAP: Record<string, string> = {
  start: 'flex-start',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
}
function flexKeyword(v: string): string {
  return FLEX_KEYWORD_MAP[v] ?? v
}

// --- Style prop keys (for separating style props from DOM props) ---
// The Record<keyof BoxStyleProps, true> ensures a compile-time error if
// BoxStyleProps gains or loses keys without updating this map.

const BOX_STYLE_PROP_MAP: Record<keyof BoxStyleProps, true> = {
  padding: true,
  paddingTop: true,
  paddingRight: true,
  paddingBottom: true,
  paddingLeft: true,
  paddingHorizontal: true,
  paddingVertical: true,
  p: true,
  pt: true,
  pr: true,
  pb: true,
  pl: true,
  px: true,
  py: true,
  margin: true,
  marginTop: true,
  marginRight: true,
  marginBottom: true,
  marginLeft: true,
  marginHorizontal: true,
  marginVertical: true,
  m: true,
  mt: true,
  mr: true,
  mb: true,
  ml: true,
  mx: true,
  my: true,
  gap: true,
  rowGap: true,
  columnGap: true,
  g: true,
  backgroundColor: true,
  color: true,
  borderColor: true,
  borderRadius: true,
  borderTopLeftRadius: true,
  borderTopRightRadius: true,
  borderBottomLeftRadius: true,
  borderBottomRightRadius: true,
  borderWidth: true,
  borderTopWidth: true,
  borderRightWidth: true,
  borderBottomWidth: true,
  borderLeftWidth: true,
  borderStyle: true,
  boxShadow: true,
  display: true,
  overflow: true,
  overflowX: true,
  overflowY: true,
  width: true,
  height: true,
  minWidth: true,
  maxWidth: true,
  minHeight: true,
  maxHeight: true,
  aspectRatio: true,
  flex: true,
  flexDirection: true,
  flexWrap: true,
  flexGrow: true,
  flexShrink: true,
  flexBasis: true,
  alignItems: true,
  alignSelf: true,
  justifyContent: true,
  alignContent: true,
  gridTemplateColumns: true,
  gridTemplateRows: true,
  gridColumn: true,
  gridRow: true,
  gridAutoFlow: true,
  gridAutoColumns: true,
  gridAutoRows: true,
  position: true,
  top: true,
  right: true,
  bottom: true,
  left: true,
  inset: true,
  zIndex: true,
  opacity: true,
  cursor: true,
  pointerEvents: true,
  visibility: true,
  userSelect: true,
  textAlign: true,
}

export const BOX_STYLE_PROP_KEYS = new Set<string>(
  Object.keys(BOX_STYLE_PROP_MAP),
)

// --- Main resolver ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StyleMap = Readonly<Record<string, any>>

export interface ResolvedStyles {
  stylexStyles: stylex.StyleXStyles[]
  inlineStyle: React.CSSProperties
  responsiveCSS: string | null
}

export function resolveBoxStyles(
  props: BoxStyleProps,
  scopeClass: string,
): ResolvedStyles {
  const sxStyles: stylex.StyleXStyles[] = []
  const inlineStyle: Record<string, string | number> = {}
  const breakpointStyles: Record<number, Record<string, string | number>> = {}
  const pseudoStyles: Record<string, Record<string, string | number>> = {}

  function addTokenProp<T extends string>(
    styleMap: StyleMap,
    cssProp: string,
    value: ResponsiveValue<T> | undefined,
    transform: (v: T) => string,
  ) {
    if (value === undefined) return

    if (isResponsive(value)) {
      for (const [bp, v] of Object.entries(value)) {
        if (v === undefined) continue
        if (bp === 'base') {
          const style = styleMap[v as string]
          if (style) sxStyles.push(style)
        } else if (isPseudoState(bp)) {
          const selector = PSEUDO_SELECTOR_MAP[bp]
          if (!pseudoStyles[selector]) pseudoStyles[selector] = {}
          pseudoStyles[selector][cssProp] = transform(v as T)
        } else {
          const bpPx = breakpoints[bp as BreakpointKey]
          if (bpPx !== undefined) {
            if (!breakpointStyles[bpPx]) breakpointStyles[bpPx] = {}
            breakpointStyles[bpPx][cssProp] = transform(v as T)
          }
        }
      }
    } else {
      const style = styleMap[value as string]
      if (style) sxStyles.push(style)
    }
  }

  function addArbitraryProp<T>(
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
          // Use scoped <style> tag (breakpoint 0) instead of inline style so that
          // media-query overrides at higher breakpoints can cascade over it.
          // Inline styles have infinite specificity and would block any override.
          if (!breakpointStyles[0]) breakpointStyles[0] = {}
          breakpointStyles[0][cssProp] = cssValue
        } else if (isPseudoState(bp)) {
          const selector = PSEUDO_SELECTOR_MAP[bp]
          if (!pseudoStyles[selector]) pseudoStyles[selector] = {}
          pseudoStyles[selector][cssProp] = cssValue
        } else {
          const bpPx = breakpoints[bp as BreakpointKey]
          if (bpPx !== undefined) {
            if (!breakpointStyles[bpPx]) breakpointStyles[bpPx] = {}
            breakpointStyles[bpPx][cssProp] = cssValue
          }
        }
      }
    } else {
      inlineStyle[cssProp] = transform(value as T)
    }
  }

  // --- Spacing (token-based) ---
  addTokenProp(paddingStyles, 'padding', props.padding ?? props.p, spacingCss)
  addTokenProp(
    paddingTopStyles,
    'padding-top',
    props.paddingTop ?? props.pt,
    spacingCss,
  )
  addTokenProp(
    paddingRightStyles,
    'padding-right',
    props.paddingRight ?? props.pr,
    spacingCss,
  )
  addTokenProp(
    paddingBottomStyles,
    'padding-bottom',
    props.paddingBottom ?? props.pb,
    spacingCss,
  )
  addTokenProp(
    paddingLeftStyles,
    'padding-left',
    props.paddingLeft ?? props.pl,
    spacingCss,
  )
  addTokenProp(
    paddingInlineStyles,
    'padding-inline',
    props.paddingHorizontal ?? props.px,
    spacingCss,
  )
  addTokenProp(
    paddingBlockStyles,
    'padding-block',
    props.paddingVertical ?? props.py,
    spacingCss,
  )

  addTokenProp(marginStyles, 'margin', props.margin ?? props.m, marginCss)
  addTokenProp(
    marginTopStyles,
    'margin-top',
    props.marginTop ?? props.mt,
    marginCss,
  )
  addTokenProp(
    marginRightStyles,
    'margin-right',
    props.marginRight ?? props.mr,
    marginCss,
  )
  addTokenProp(
    marginBottomStyles,
    'margin-bottom',
    props.marginBottom ?? props.mb,
    marginCss,
  )
  addTokenProp(
    marginLeftStyles,
    'margin-left',
    props.marginLeft ?? props.ml,
    marginCss,
  )
  addTokenProp(
    marginInlineStyles,
    'margin-inline',
    props.marginHorizontal ?? props.mx,
    marginCss,
  )
  addTokenProp(
    marginBlockStyles,
    'margin-block',
    props.marginVertical ?? props.my,
    marginCss,
  )

  addTokenProp(gapStyles, 'gap', props.gap ?? props.g, spacingCss)
  addTokenProp(rowGapStyles, 'row-gap', props.rowGap, spacingCss)
  addTokenProp(columnGapStyles, 'column-gap', props.columnGap, spacingCss)

  // --- Colors (token-based) ---
  addTokenProp(
    backgroundColorStyles,
    'background-color',
    props.backgroundColor,
    colorCss,
  )
  addTokenProp(colorStyles, 'color', props.color, colorCss)
  addTokenProp(borderColorStyles, 'border-color', props.borderColor, colorCss)

  // --- Border radius (token-based) ---
  addTokenProp(
    borderRadiusStyles,
    'border-radius',
    props.borderRadius,
    radiusCss,
  )
  addTokenProp(
    borderTopLeftRadiusStyles,
    'border-top-left-radius',
    props.borderTopLeftRadius,
    radiusCss,
  )
  addTokenProp(
    borderTopRightRadiusStyles,
    'border-top-right-radius',
    props.borderTopRightRadius,
    radiusCss,
  )
  addTokenProp(
    borderBottomLeftRadiusStyles,
    'border-bottom-left-radius',
    props.borderBottomLeftRadius,
    radiusCss,
  )
  addTokenProp(
    borderBottomRightRadiusStyles,
    'border-bottom-right-radius',
    props.borderBottomRightRadius,
    radiusCss,
  )

  // --- Border width (arbitrary) ---
  addArbitraryProp('borderWidth', props.borderWidth, px)
  addArbitraryProp('borderTopWidth', props.borderTopWidth, px)
  addArbitraryProp('borderRightWidth', props.borderRightWidth, px)
  addArbitraryProp('borderBottomWidth', props.borderBottomWidth, px)
  addArbitraryProp('borderLeftWidth', props.borderLeftWidth, px)

  // --- Border style (token-based) ---
  addTokenProp(borderStyleStyles, 'border-style', props.borderStyle, (v) => v)

  // --- Shadow (token-based) ---
  addTokenProp(boxShadowStyles, 'box-shadow', props.boxShadow, shadowCss)

  // --- Layout ---
  addTokenProp(displayStyles, 'display', props.display, (v) => v)
  addTokenProp(overflowStyles, 'overflow', props.overflow, (v) => v)
  addTokenProp(overflowXStyles, 'overflow-x', props.overflowX, (v) => v)
  addTokenProp(overflowYStyles, 'overflow-y', props.overflowY, (v) => v)

  // Width/height (arbitrary)
  addArbitraryProp('width', props.width, sizeValue)
  addArbitraryProp('height', props.height, sizeValue)
  addArbitraryProp('minWidth', props.minWidth, sizeValue)
  addArbitraryProp('maxWidth', props.maxWidth, sizeValue)
  addArbitraryProp('minHeight', props.minHeight, sizeValue)
  addArbitraryProp('maxHeight', props.maxHeight, sizeValue)
  addArbitraryProp('aspectRatio', props.aspectRatio, (v) => v)

  // --- Flex ---
  addArbitraryProp('flex', props.flex, (v) =>
    typeof v === 'number' ? `${v} ${v} 0%` : v,
  )
  addTokenProp(
    flexDirectionStyles,
    'flex-direction',
    props.flexDirection,
    (v) => v,
  )
  addTokenProp(flexWrapStyles, 'flex-wrap', props.flexWrap, (v) => v)
  addArbitraryProp('flexGrow', props.flexGrow, (v) => v)
  addArbitraryProp('flexShrink', props.flexShrink, (v) => v)
  addArbitraryProp('flexBasis', props.flexBasis, sizeValue)
  addTokenProp(alignItemsStyles, 'align-items', props.alignItems, flexKeyword)
  addTokenProp(alignSelfStyles, 'align-self', props.alignSelf, flexKeyword)
  addTokenProp(
    justifyContentStyles,
    'justify-content',
    props.justifyContent,
    flexKeyword,
  )
  addTokenProp(
    alignContentStyles,
    'align-content',
    props.alignContent,
    flexKeyword,
  )

  // --- Grid ---
  addArbitraryProp('gridTemplateColumns', props.gridTemplateColumns, (v) => v)
  addArbitraryProp('gridTemplateRows', props.gridTemplateRows, (v) => v)
  addArbitraryProp('gridColumn', props.gridColumn, (v) => v)
  addArbitraryProp('gridRow', props.gridRow, (v) => v)
  addTokenProp(
    gridAutoFlowStyles,
    'grid-auto-flow',
    props.gridAutoFlow,
    (v) => v,
  )
  addArbitraryProp('gridAutoColumns', props.gridAutoColumns, (v) => v)
  addArbitraryProp('gridAutoRows', props.gridAutoRows, (v) => v)

  // --- Position ---
  addTokenProp(positionStyles, 'position', props.position, (v) => v)
  addArbitraryProp('top', props.top, sizeValue)
  addArbitraryProp('right', props.right, sizeValue)
  addArbitraryProp('bottom', props.bottom, sizeValue)
  addArbitraryProp('left', props.left, sizeValue)
  addArbitraryProp('inset', props.inset, sizeValue)
  addArbitraryProp('zIndex', props.zIndex, (v) => v)

  // --- Visual ---
  addArbitraryProp('opacity', props.opacity, (v) => v)
  addTokenProp(cursorStyles, 'cursor', props.cursor, (v) => v)
  addTokenProp(
    pointerEventsStyles,
    'pointer-events',
    props.pointerEvents,
    (v) => v,
  )
  addTokenProp(visibilityStyles, 'visibility', props.visibility, (v) => v)
  addTokenProp(userSelectStyles, 'user-select', props.userSelect, (v) => v)
  addTokenProp(textAlignStyles, 'text-align', props.textAlign, (v) => v)

  // --- Build scoped CSS for breakpoint + pseudo-state values ---
  const bpKeys = Object.keys(breakpointStyles)
    .map(Number)
    .sort((a, b) => a - b)
  const pseudoKeys = Object.keys(pseudoStyles)
  let responsiveCSS: string | null = null

  if (bpKeys.length > 0 || pseudoKeys.length > 0) {
    // StyleX uses :not(#\#) x3 for specificity (3,1,0). We use x4 to ensure
    // scoped overrides always win over the base StyleX atomic classes.
    const selector = `.${scopeClass}:not(#\\#):not(#\\#):not(#\\#):not(#\\#)`
    const parts: string[] = []

    for (const bp of bpKeys) {
      const entries = Object.entries(breakpointStyles[bp])
        .map(([k, v]) => `${toKebab(k)}: ${v}`)
        .join('; ')
      // Breakpoint 0 = base styles for responsive arbitrary props (no media query).
      // Higher breakpoints are wrapped in @media so they cascade over the base.
      if (bp === 0) {
        parts.push(`${selector} { ${entries} }`)
      } else {
        parts.push(`@media (min-width: ${bp}px) { ${selector} { ${entries} } }`)
      }
    }

    for (const pseudo of pseudoKeys) {
      const entries = Object.entries(pseudoStyles[pseudo])
        .map(([k, v]) => `${toKebab(k)}: ${v}`)
        .join('; ')
      parts.push(`${selector}${pseudo} { ${entries} }`)
    }

    responsiveCSS = parts.join(' ')
  }

  return {
    stylexStyles: sxStyles,
    inlineStyle: inlineStyle as React.CSSProperties,
    responsiveCSS,
  }
}
