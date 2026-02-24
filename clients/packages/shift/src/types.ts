export type TokenType =
  | 'color'
  | 'dimension'
  | 'fontFamily'
  | 'fontWeight'
  | 'duration'
  | 'cubicBezier'
  | 'number'
  | 'string'
  | 'shadow'
  | 'gradient'

export type ColorSpace = 'srgb' | 'display-p3' | 'hsl' | 'oklch'

export interface ColorValue {
  colorSpace: ColorSpace
  components: number[]
  alpha?: number
  hex?: string
}

export interface DimensionValue {
  value: number
  unit: string
}

export type TokenValue = string | number | ColorValue | DimensionValue

export interface RawToken {
  value: TokenValue
  type?: TokenType
  category?: string
  description?: string
  /** Component token theme overrides: theme name → value (alias or literal) */
  themes?: Record<string, TokenValue>
  /** Responsive breakpoint overrides: breakpoint name → value (alias or literal) */
  breakpoints?: Record<string, TokenValue>
}

// Recursive: keys are either nested groups or token leafs
export type TokenGroup = {
  [key: string]: RawToken | TokenGroup | unknown
}

export interface TokenDocumentGlobal {
  type?: TokenType
  category?: string
}

export interface TokenDocument {
  props: TokenGroup
  imports: string[]
  global?: TokenDocumentGlobal
}

/** Per-theme or per-breakpoint value on a resolved token */
export interface ThemeValue {
  /** Concrete resolved value */
  value: TokenValue
  /** Dot-path of the direct alias source, if this was an alias reference */
  aliasOf?: string
}

export interface ResolvedToken {
  /** e.g. "colors-primary" (kebab, used as CSS var name) */
  path: string
  /** ['colors', 'primary'] */
  rawPath: string[]
  /** Concrete resolved value */
  value: TokenValue
  /** Dot-path of the direct alias source, if $value was an alias */
  aliasOf?: string
  type: TokenType
  category?: string
  description?: string
  /** Theme-specific value overrides, keyed by theme name */
  themeValues?: Record<string, ThemeValue>
  /** Breakpoint-specific value overrides, keyed by breakpoint name */
  breakpointValues?: Record<string, ThemeValue>
}

export type FlatTokenMap = Map<string, ResolvedToken>

/**
 * Maps theme names to their CSS selector.
 * e.g. { dark: ':root .dark', 'high-contrast': ':root .high-contrast' }
 */
export type ThemeConfig = Record<string, string>

/**
 * Maps breakpoint names to their CSS media query condition (without @media).
 * e.g. { sm: '(min-width: 640px)', md: '(min-width: 768px)' }
 */
export type BreakpointConfig = Record<string, string>
