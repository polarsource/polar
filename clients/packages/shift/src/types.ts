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

export interface RawToken {
  $value: string | number
  $type?: TokenType
  $description?: string
  /** Component token theme overrides: theme name → value (alias or literal) */
  $themes?: Record<string, string | number>
}

// Recursive: keys are either nested groups or token leafs
export type TokenGroup = {
  $type?: TokenType           // inherited type for children
  $description?: string
  [key: string]: RawToken | TokenGroup | unknown
}

/** Per-theme value on a resolved token */
export interface ThemeValue {
  /** Concrete resolved value */
  value: string | number
  /** Dot-path of the direct alias source, if this was an alias reference */
  aliasOf?: string
}

export interface ResolvedToken {
  /** e.g. "colors-primary" (kebab, used as CSS var name) */
  path: string
  /** ['colors', 'primary'] */
  rawPath: string[]
  /** Concrete resolved value */
  value: string | number
  /** Dot-path of the direct alias source, if $value was an alias */
  aliasOf?: string
  type: TokenType
  description?: string
  /** Theme-specific value overrides, keyed by theme name */
  themeValues?: Record<string, ThemeValue>
}

export type FlatTokenMap = Map<string, ResolvedToken>

/**
 * Maps theme names to their CSS selector.
 * e.g. { dark: ':root .dark', 'high-contrast': ':root .high-contrast' }
 */
export type ThemeConfig = Record<string, string>
