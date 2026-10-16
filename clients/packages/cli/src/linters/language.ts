export type Category =
  | 'clock'
  | 'random'
  | 'environment'
  | 'network'
  | 'filesystem'

export interface Import {
  readonly specifier: string
  readonly line: number
  readonly column: number
}

export interface Language {
  readonly extensions: ReadonlyArray<string>
  readonly lineComment: string
  readonly blockComment?: readonly [open: string, close: string]
  readonly patterns: Readonly<Record<Category, ReadonlyArray<string>>>
  readonly modules: Readonly<Partial<Record<Category, ReadonlyArray<string>>>>
  readonly imports: (source: string) => ReadonlyArray<Import>
  readonly relative: (specifier: string) => boolean
  readonly candidates: (
    from: string,
    specifier: string,
  ) => ReadonlyArray<string>
}
