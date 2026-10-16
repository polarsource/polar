import { extname } from 'node:path'
import {
  type Example,
  type LanguageId,
  type Rule,
  type RuleId,
  RULES,
} from '@/linters/rules'
import { type Lines, only, tokenizeJavaScript } from '@/linters/utils/tokens'
import type { ConfigIssue } from '@/schemas/BillingConfig'
import { escapeRegExp } from '@/utils/regexp'

interface Language {
  readonly id: LanguageId
  readonly extensions: ReadonlyArray<string>
  readonly tokenize: (source: string) => Lines
}

const LANGUAGES: ReadonlyArray<Language> = [
  {
    id: 'typescript',
    extensions: ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'],
    tokenize: tokenizeJavaScript,
  },
]

const SHAPE = /^(.*?)(\(\.\.\.\)|\(\))?$/

const ARGUMENTS = {
  '(...)': '\\(',
  '()': '\\(\\s*\\)',
  '': '\\b',
} as const

export const compileExample = (example: Example): RegExp => {
  const [, callee = '', call = ''] = SHAPE.exec(example) ?? []
  const name = callee.trim().split(/\s+/).map(escapeRegExp).join('\\s+')
  return new RegExp(
    `(?<![\\w$])${name}${ARGUMENTS[call as keyof typeof ARGUMENTS]}`,
    'g',
  )
}

interface Matcher {
  readonly id: RuleId
  readonly rule: Rule
  readonly patterns: ReadonlyArray<RegExp>
}

const matchers = new Map<LanguageId, ReadonlyArray<Matcher>>()

const matchersFor = (language: Language) => {
  const cached = matchers.get(language.id)
  if (cached) return cached
  const compiled = (Object.entries(RULES) as [RuleId, Rule][]).map(
    ([id, rule]) => ({
      id,
      rule,
      patterns: (rule.code[language.id] ?? []).map(compileExample),
    }),
  )
  matchers.set(language.id, compiled)
  return compiled
}

const DIRECTIVE = /polar-disable-(next-)?line\b/

const findings = (code: string, line: number, language: Language) =>
  matchersFor(language)
    .flatMap(({ id, rule, patterns }) =>
      patterns.flatMap((pattern) =>
        [...code.matchAll(pattern)].map(
          (match): ConfigIssue => ({
            severity: rule.severity,
            code: id,
            path: match[0].replace(/\(\s*\)?$/, ''),
            message: rule.message,
            location: {
              line,
              column: (match.index ?? 0) + 1,
              length: match[0].length,
            },
          }),
        ),
      ),
    )
    .sort((a, b) => (a.location?.column ?? 0) - (b.location?.column ?? 0))

export const lint = (
  file: string,
  source: string,
): ReadonlyArray<ConfigIssue> => {
  const language = LANGUAGES.find((candidate) =>
    candidate.extensions.includes(extname(file)),
  )
  if (language === undefined) return []
  let disabledNext = false
  return language.tokenize(source).flatMap((spans, index) => {
    const directive = DIRECTIVE.exec(only(spans, (kind) => kind === 'comment'))
    const disabled = disabledNext || (directive !== null && !directive[1])
    disabledNext = directive?.[1] !== undefined
    if (disabled) return []
    return findings(
      only(spans, (kind) => kind === 'code'),
      index + 1,
      language,
    )
  })
}
