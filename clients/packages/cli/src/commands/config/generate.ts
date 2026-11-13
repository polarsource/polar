import { basename, dirname, join } from 'node:path'
import { Effect, FileSystem, Option, Schema } from 'effect'
import { Command, Flag } from 'effect/cli'
import { BillingConfigError } from '@/schemas/BillingConfig'
import { BillingConfig } from '@/services/billing-config/service'
import {
  generate as generateSource,
  GENERATED_LANGUAGES,
  GENERATED_MARKER,
  type GeneratedLanguage,
  GENERATORS,
} from '@/utils/billing-config/generate'
import { namesOf, unreadable } from '@/utils/billing-config/generate/names'
import { plural } from '@/utils/billing-config/problems'
import { output } from '@/utils/command'
import { configFile as file } from '@/utils/flags'
import * as ui from '@/utils/ui'

const LANGUAGE_NAMES = new Map<string, GeneratedLanguage>(
  GENERATED_LANGUAGES.flatMap((language) => [
    [language, language] as const,
    ...GENERATORS[language].aliases.map((alias) => [alias, language] as const),
  ]),
)

const CHOICES = GENERATED_LANGUAGES.map(
  (language) => `${GENERATORS[language].title} (${language})`,
).join(', ')

const language = Flag.Literals('language', [...LANGUAGE_NAMES.keys()]).pipe(
  Flag.optional,
  Flag.withDescription(
    `The language to generate: ${CHOICES}. When omitted it follows the file name given to --out, then the project next to the config or in the current directory`,
  ),
)

const out = Flag.String('out').pipe(
  Flag.optional,
  Flag.withDescription(
    'Where to write the file. Defaults to a file next to the config, named after the language. A file this command did not write is never replaced',
  ),
)

const check = Flag.Boolean('check').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'Write nothing, and fail when the generated file is missing or out of date',
  ),
)

const GenerateOutput = Schema.Struct({
  file: Schema.String,
  language: Schema.Literals(GENERATED_LANGUAGES),
  status: Schema.Literals(['written', 'unchanged', 'outdated', 'missing']),
  command: Schema.String,
  events: Schema.Finite,
  meters: Schema.Finite,
  benefits: Schema.Finite,
  products: Schema.Finite,
})
type GenerateOutput = typeof GenerateOutput.Type

const languageOfFile = (path: string) =>
  GENERATED_LANGUAGES.find((language) =>
    path.endsWith(GENERATORS[language].extension),
  )

const detect = (
  fs: FileSystem.FileSystem,
  directories: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    for (const directory of directories) {
      for (const detected of GENERATED_LANGUAGES) {
        const found = yield* fs
          .exists(join(directory, GENERATORS[detected].manifest))
          .pipe(Effect.orElseSucceed(() => false))
        if (found) return detected
      }
    }
    const [only, ...others] = GENERATED_LANGUAGES
    if (only !== undefined && others.length === 0) return only
    return yield* new BillingConfigError({
      message: 'Could not tell which language to generate',
      hint: `Pass --language with one of: ${GENERATED_LANGUAGES.join(', ')}.`,
    })
  })

const summary = (result: GenerateOutput) =>
  [
    plural(result.meters, 'meter', 'meters'),
    plural(result.benefits, 'benefit', 'benefits'),
    plural(result.products, 'product', 'products'),
    plural(result.events, 'event', 'events'),
  ].join(', ')

const render = (result: GenerateOutput) =>
  result.status === 'outdated' || result.status === 'missing'
    ? [ui.blank]
    : [
        ui.blank,
        ui.success(
          result.status === 'written'
            ? `${result.file} written: ${summary(result)}`
            : `${result.file} is up to date`,
        ),
        ui.blank,
      ]

const writtenByGenerate = (source: string) =>
  source.split('\n', 1).some((line) => line.includes(GENERATED_MARKER))

const generated = (
  fs: FileSystem.FileSystem,
  target: string,
  source: string,
  check: boolean,
) =>
  Effect.gen(function* () {
    const current = yield* fs
      .readFileString(target)
      .pipe(Effect.orElseSucceed(() => undefined))
    if (current === source) return 'unchanged' as const
    if (check) return current === undefined ? 'missing' : 'outdated'
    if (current !== undefined && !writtenByGenerate(current)) {
      return yield* new BillingConfigError({
        message: `${target} exists and was not written by polar config generate`,
        hint: 'Pass --out with another path, or remove the file first.',
      })
    }
    yield* fs.makeDirectory(dirname(target), { recursive: true }).pipe(
      Effect.andThen(fs.writeFileString(target, source)),
      Effect.mapError(
        (error) =>
          new BillingConfigError({
            message: `Could not write ${target}`,
            hint: error.message,
          }),
      ),
    )
    return 'written' as const
  })

export const generate = Command.make('generate', {
  file,
  language,
  out,
  check,
}).pipe(
  Command.withDescription(
    'Write the meters, benefits, products and events of a billing config as names your application code can import, so a misspelled one fails before it runs',
  ),
  Command.withExamples([
    {
      command: 'polar config generate',
      description:
        'Write the names next to the config, in the language of the project',
    },
    {
      command: 'polar config generate --out app/polar_types.py',
      description: 'Choose where the file goes',
    },
    {
      command: 'polar config generate --check',
      description: 'Fail in CI when the generated file is out of date',
    },
  ]),
  output({
    result: GenerateOutput,
    run: ({ file, language, out, check }) =>
      Effect.gen(function* () {
        const billing = yield* BillingConfig
        const fs = yield* FileSystem.FileSystem
        const given = Option.getOrUndefined(file)
        const config = yield* billing.load(given)
        const directory = dirname(config.file)
        const requested = Option.getOrUndefined(language)
        const path = Option.getOrUndefined(out)
        const chosen =
          (requested === undefined
            ? undefined
            : LANGUAGE_NAMES.get(requested)) ??
          (path === undefined ? undefined : languageOfFile(path)) ??
          (yield* detect(fs, [directory, process.cwd()]))
        const { extension, title } = GENERATORS[chosen]
        if (path !== undefined && !path.endsWith(extension)) {
          return yield* new BillingConfigError({
            message: `${path} is not a ${title} file`,
            hint: `Give --out a path that ends in ${extension}.`,
          })
        }
        const reason = unreadable(config.input)
        if (reason !== undefined) {
          return yield* new BillingConfigError({
            message: `Could not read the names in ${config.file}`,
            hint: `${reason} Run polar config plan to see what to fix.`,
          })
        }
        const target = path ?? join(directory, GENERATORS[chosen].file)
        const source = generateSource(
          config.input,
          chosen,
          basename(config.file),
        )
        const names = namesOf(config.input)
        return {
          file: target,
          language: chosen,
          status: yield* generated(fs, target, source, check),
          command: [
            'polar config generate',
            ...(given === undefined ? [] : [given]),
            ...(requested === undefined ? [] : ['--language', chosen]),
            ...(path === undefined ? [] : ['--out', path]),
          ].join(' '),
          events: names.events.length,
          meters: names.meters.length,
          benefits: names.benefits.length,
          products: names.products.length,
        } satisfies GenerateOutput
      }),
    render,
    failed: (result) =>
      result.status === 'outdated' || result.status === 'missing'
        ? new BillingConfigError({
            message:
              result.status === 'missing'
                ? `${result.file} has not been generated`
                : `${result.file} is out of date`,
            hint: `Run ${result.command} and commit the result.`,
          })
        : undefined,
  }),
)
