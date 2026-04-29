export type Modifier =
  | 'dark'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | 'hover'
  | 'focus'
  | 'active'
  | 'focus-visible'
  | 'focus-within'

export interface ParsedClass {
  raw: string
  modifiers: Modifier[]
  utility: string
  important: boolean
}

export interface PropValue {
  base?: unknown
  hover?: unknown
  focus?: unknown
  active?: unknown
  focusVisible?: unknown
  focusWithin?: unknown
  sm?: unknown
  md?: unknown
  lg?: unknown
  xl?: unknown
}

export interface MappedProp {
  prop: string
  value: PropValue
  consumesClasses: string[]
}

export interface ElementReport {
  file: string
  line: number
  status: 'converted' | 'partial' | 'skipped'
  reason?: string
  leftover?: string[]
  ambiguous?: string[]
}
