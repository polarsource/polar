import { Effect } from 'effect'
import { type ParseError, parse, printParseErrorCode } from 'jsonc-parser'
import { BillingConfigError, CONFIG_FILES } from '@/schemas/BillingConfig'
import {
  dropOptionalNulls,
  type Language,
  readSource,
  span,
} from '@/services/billing-config/languages/language'
import { locateInJson } from '@/services/billing-config/languages/json/locate'
import { removeFromJson } from '@/services/billing-config/languages/json/remove'

type ErrorName = ReturnType<typeof printParseErrorCode>

const REASONS: Partial<Record<ErrorName, string>> = {
  CommaExpected: 'A comma is missing before this.',
  ColonExpected: 'A colon is missing before this.',
  CloseBraceExpected: 'A closing } is missing.',
  CloseBracketExpected: 'A closing ] is missing.',
  PropertyNameExpected:
    'A property name in double quotes is missing here, or the comma before it should go.',
  ValueExpected: 'A value is missing here, or the comma before it should go.',
  InvalidCommentToken: 'JSON does not allow comments.',
  InvalidSymbol:
    'This is not JSON. Strings and property names need double quotes.',
}

const syntaxError = (file: string, source: string, fallback: string) => {
  if (source.trim() === '') return 'The file is empty.'
  const errors: Array<ParseError> = []
  parse(source, errors, { allowTrailingComma: false, disallowComments: true })
  const [first] = errors
  if (first === undefined) return fallback
  const { line, column } = span(source, first.offset, first.length)
  return `${file}:${line}:${column} ${REASONS[printParseErrorCode(first.error)] ?? fallback}`
}

export const json: Language = {
  title: 'JSON',
  format: 'json',
  extension: '.json',
  extensions: ['.json'],
  defaultFiles: CONFIG_FILES.json,
  manifests: [{ file: 'pyproject.toml', project: 'Python' }],
  installer: undefined,
  load: (fs, file) =>
    Effect.gen(function* () {
      const source = yield* readSource(fs, file)
      const input = yield* Effect.try({
        try: () => JSON.parse(source) as unknown,
        catch: (error) =>
          new BillingConfigError({
            message: `${file} is not valid JSON`,
            hint: syntaxError(
              file,
              source,
              error instanceof Error ? error.message : String(error),
            ),
          }),
      })
      return { file, source, input, generated: false }
    }),
  render: (document) =>
    Effect.succeed(`${JSON.stringify(dropOptionalNulls(document), null, 2)}\n`),
  locate: ({ source }, path, _got, target) =>
    locateInJson(source, path, target),
  remove: ({ source, input }, removals) =>
    removeFromJson(source, input, removals),
}
