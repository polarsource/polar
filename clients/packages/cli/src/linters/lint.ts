import { readFileSync } from 'node:fs'
import { dirname, extname, relative, resolve } from 'node:path'
import type { Category, Import, Language } from '@/linters/language'
import { escapeRegExp, type Open, only, tokenize } from '@/linters/utils/tokens'
import { typescript } from '@/linters/typescript'
import type { ConfigIssue } from '@/schemas/BillingConfig'

const LANGUAGES: ReadonlyArray<Language> = [typescript]

const languageOf = (file: string) =>
  LANGUAGES.find((language) => language.extensions.includes(extname(file)))

const SEVERITY: Readonly<Record<Category, ConfigIssue['severity']>> = {
  clock: 'error',
  random: 'error',
  environment: 'warning',
  network: 'error',
  filesystem: 'warning',
}

const MESSAGES: Readonly<Record<Category, string>> = {
  clock: 'Reads the clock',
  random: 'Uses a random value',
  environment: 'Reads an environment variable',
  network: 'Makes a network request',
  filesystem: 'Reads a file',
}

export type ReadSource = (file: string) => string | undefined

const readSource: ReadSource = (file) => {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return undefined
  }
}

const DISABLE = /polar-disable-(next-)?line\b([^*]*)/

interface Disabled {
  readonly nextLine: boolean
  readonly codes: ReadonlyArray<string>
}

const disabled = (comment: string): Disabled | undefined => {
  const match = DISABLE.exec(comment)
  if (!match) return undefined
  return {
    nextLine: match[1] !== undefined,
    codes: (match[2] ?? '')
      .split(/[\s,]+/)
      .filter((code) => /^\w+$/.test(code)),
  }
}

const suppressed = (code: string, directive: Disabled | undefined) =>
  directive !== undefined &&
  (directive.codes.length === 0 || directive.codes.includes(code))

const occurrences = (line: string, pattern: string) =>
  [
    ...line.matchAll(new RegExp(`(?<![\\w$])${escapeRegExp(pattern)}`, 'g')),
  ].map((match) => (match.index ?? 0) + 1)

interface Finding {
  readonly severity: ConfigIssue['severity']
  readonly code: string
  readonly path: string
  readonly message: string
  readonly column: number
  readonly length: number
  readonly origin: { readonly file: string; readonly line: number }
}

type Located = Finding & { readonly line: number }

const finding = (
  category: Category,
  path: string,
  column: number,
  length: number,
  origin: Finding['origin'],
): Finding => ({
  severity: SEVERITY[category],
  code: `reads_${category}`,
  path,
  message: MESSAGES[category],
  column,
  length,
  origin,
})

const matches = (
  file: string,
  line: number,
  code: string,
  language: Language,
): ReadonlyArray<Finding> =>
  Object.entries(language.patterns).flatMap(([category, patterns]) =>
    patterns.flatMap((pattern) =>
      occurrences(code, pattern).map((column) =>
        finding(
          category as Category,
          pattern.replace(/\($/, ''),
          column,
          pattern.length,
          { file, line },
        ),
      ),
    ),
  )

const moduleCategory = (specifier: string, language: Language) =>
  (
    Object.entries(language.modules) as [Category, ReadonlyArray<string>][]
  ).find(([, names]) =>
    names.some(
      (name) => specifier === name || specifier.startsWith(`${name}/`),
    ),
  )?.[0]

const resolveImport = (
  from: string,
  specifier: string,
  language: Language,
  read: ReadSource,
) => {
  const file = language
    .candidates(from, specifier)
    .find((candidate) => read(candidate) !== undefined)
  const source = file === undefined ? undefined : read(file)
  return file === undefined || source === undefined
    ? undefined
    : { file, source }
}

const imported = (
  from: string,
  imports: ReadonlyArray<Import>,
  language: Language,
  read: ReadSource,
  visited: Set<string>,
): ReadonlyArray<Finding> =>
  imports.flatMap(({ specifier, line, column }) => {
    const category = moduleCategory(specifier, language)
    if (category !== undefined) {
      return [
        finding(category, specifier, column, specifier.length, {
          file: from,
          line,
        }),
      ]
    }
    if (!language.relative(specifier)) return []
    const target = resolveImport(from, specifier, language, read)
    if (target === undefined || visited.has(target.file)) return []
    return findings(target.file, target.source, read, visited).map((found) => ({
      ...found,
      column,
      length: specifier.length,
    }))
  })

const findings = (
  file: string,
  source: string,
  read: ReadSource,
  visited: Set<string>,
): ReadonlyArray<Located> => {
  const language = languageOf(file)
  if (language === undefined) return []
  visited.add(file)
  const imports = language.imports(source)
  let open: Open
  let previous: Disabled | undefined
  return source.split('\n').flatMap((text, index) => {
    const line = index + 1
    const tokens = tokenize(text, language, open)
    open = tokens.open
    const inline = disabled(only(tokens.spans, (kind) => kind === 'comment'))
    const before = previous
    previous = inline?.nextLine ? inline : undefined
    return [
      ...matches(
        file,
        line,
        only(tokens.spans, (kind) => kind === 'code'),
        language,
      ),
      ...imported(
        file,
        imports.filter((entry) => entry.line === line),
        language,
        read,
        visited,
      ),
    ]
      .filter(
        (found) =>
          !suppressed(found.code, before) &&
          !suppressed(found.code, inline?.nextLine ? undefined : inline),
      )
      .sort((a, b) => a.column - b.column)
      .map((found) => ({ ...found, line }))
  })
}

export const lint = (
  entry: string,
  source: string,
  read: ReadSource = readSource,
): ReadonlyArray<ConfigIssue> => {
  const file = resolve(entry)
  return findings(file, source, read, new Set()).map(
    ({ severity, code, path, message, line, column, length, origin }) => ({
      severity,
      code,
      path,
      message:
        origin.file === file
          ? message
          : `${message} in ${relative(dirname(file), origin.file)}:${origin.line}`,
      location: { line, column, length },
    }),
  )
}
