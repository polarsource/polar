import type { ReactNode } from 'react'

export type Layout = 'code' | 'scene' | 'split'
export type Lang = 'typescript' | 'json' | 'bash'

/** One screen of a lesson. Omit `code` to keep the previous step's file. */
export interface Step {
  readonly id: string
  readonly prose: ReactNode
  readonly code?: string
  /** Language and file name for this step's code; default to the lesson's. */
  readonly lang?: Lang
  readonly file?: string
  /** 1-based lines to highlight; the rest of the file dims. */
  readonly focus?: readonly number[]
  /** A visualization shown instead of, or beside, the code. */
  readonly scene?: ReactNode
  /** Defaults to `split` when a scene is given, otherwise `code`. */
  readonly layout?: Layout
}

export interface Lesson {
  readonly slug: string
  readonly title: string
  readonly summary: string
  readonly lang?: Lang
  readonly file?: string
  readonly steps: readonly Step[]
}

/** A chapter that is planned but not written yet. Listed, not linked. */
export interface Planned {
  readonly slug: string
  readonly title: string
  readonly summary: string
}

export interface Token {
  readonly content: string
  /** Shiki's per-theme color variables for this token. */
  readonly style?: Record<string, string>
}

/** A highlighted line with a key that survives across steps when the line does. */
export interface Line {
  readonly key: string
  readonly tokens: readonly Token[]
  readonly focused: boolean
}

export interface PreparedStep {
  readonly id: string
  readonly prose: ReactNode
  readonly scene?: ReactNode
  readonly layout: Layout
  readonly file: string
  readonly lines: readonly Line[]
}
