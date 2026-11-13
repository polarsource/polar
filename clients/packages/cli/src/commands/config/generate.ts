import {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'
import { Effect, FileSystem, Option, Schema } from 'effect'
import { Command, Flag } from 'effect/cli'
import { BillingConfigError } from '@/schemas/BillingConfig'
import { BillingConfig } from '@/services/billing-config/service'
import {
  GENERATED_LANGUAGES,
  GENERATORS,
} from '@/utils/billing-config/generate'
import {
  generate as generateSource,
  type Generator,
  isGenerated,
} from '@/utils/billing-config/generate/contract'
import { namesOf, unreadable } from '@/utils/billing-config/generate/names'
import {
  rememberedOut,
  rememberOut,
  SETTINGS_KEY,
} from '@/utils/billing-config/generate/settings'
import { plural } from '@/utils/billing-config/problems'
import { output } from '@/utils/command'
import { configFile as file } from '@/utils/flags'
import * as ui from '@/utils/ui'

const CHOICES = GENERATED_LANGUAGES.map(
  (language) => `${GENERATORS[language].title} (${language})`,
).join(', ')

const language = Flag.Literals('language', GENERATED_LANGUAGES).pipe(
  Flag.optional,
  Flag.withDescription(
    `The language to generate: ${CHOICES}. When omitted it follows the file name given to --out, then the nearest project at or above the config or the current directory`,
  ),
)

const DEFAULT_FILES = GENERATED_LANGUAGES.map(
  (language) => GENERATORS[language].file,
).join(' or ')

const out = Flag.String('out').pipe(
  Flag.optional,
  Flag.withDescription(
    `Where to write the file. Defaults to ${DEFAULT_FILES} next to the config. A JSON config remembers it as ${SETTINGS_KEY}.out, so later runs and --check need no flag. A file this command did not write is never replaced`,
  ),
)

const check = Flag.Boolean('check').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'Write nothing, and fail when the generated file is missing or out of date',
  ),
)

const GenerateOutput = Schema.Struct({
  config: Schema.String,
  file: Schema.String,
  language: Schema.Literals(GENERATED_LANGUAGES),
  status: Schema.Literals(['written', 'unchanged', 'outdated', 'missing']),
  command: Schema.String,
  saved: Schema.Boolean,
  events: Schema.Finite,
  meters: Schema.Finite,
  benefits: Schema.Finite,
  products: Schema.Finite,
})
type GenerateOutput = typeof GenerateOutput.Type

const languageOfFile = (path: string) =>
  GENERATED_LANGUAGES.find(
    (language) => extname(GENERATORS[language].file) === extname(path),
  )

const ancestors = (from: string) => {
  const directories = [resolve(from)]
  for (
    let parent = dirname(resolve(from));
    parent !== directories.at(-1);
    parent = dirname(parent)
  ) {
    directories.push(parent)
  }
  return directories
}

const detect = (
  fs: FileSystem.FileSystem,
  directories: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    const manifests = directories.flatMap((directory) =>
      GENERATED_LANGUAGES.flatMap((language) =>
        GENERATORS[language].manifests.map((manifest) => ({
          language,
          path: join(directory, manifest),
        })),
      ),
    )
    for (const { language, path } of manifests) {
      const found = yield* fs
        .exists(path)
        .pipe(Effect.orElseSucceed(() => false))
      if (found) return language
    }
    return yield* new BillingConfigError({
      message: 'Could not tell which language to generate',
      hint: `Pass --language with one of: ${GENERATED_LANGUAGES.join(', ')}.`,
    })
  })

const summary = (result: GenerateOutput) =>
  [
    plural(result.meters, 'meter'),
    plural(result.benefits, 'benefit'),
    plural(result.products, 'product'),
    plural(result.events, 'event'),
  ].join(', ')

const render = (result: GenerateOutput) => {
  if (result.status === 'outdated' || result.status === 'missing') {
    return [ui.blank]
  }
  if (result.status === 'unchanged') {
    return [ui.blank, ui.success(`${result.file} is up to date`), ui.blank]
  }
  return [
    ui.blank,
    ui.success(
      `${result.file} written from ${result.config}: ${summary(result)}`,
    ),
    ...[
      ...(result.saved
        ? [
            `${result.config} now remembers where it goes, so the next run needs no flags.`,
          ]
        : []),
      `Import its names in your code. In CI, ${result.command} --check fails when it is out of date.`,
    ].map((line) => `${ui.INDENT}${ui.INDENT}${ui.dim(line)}`),
    ui.blank,
  ]
}

const generated = (
  fs: FileSystem.FileSystem,
  target: string,
  source: string,
  generator: Generator,
  check: boolean,
) =>
  Effect.gen(function* () {
    const current = yield* fs
      .readFileString(target)
      .pipe(Effect.orElseSucceed(() => undefined))
    if (current?.replaceAll('\r\n', '\n') === source) {
      return 'unchanged' as const
    }
    if (current !== undefined && !isGenerated(current, generator)) {
      return yield* new BillingConfigError({
        message: `${target} exists and was not written by polar config generate`,
        hint: 'Pass --out with another path, or remove the file first.',
      })
    }
    if (check) return current === undefined ? 'missing' : 'outdated'
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
    'Write the names in a billing config (its meters, benefits, products and the events its meters count) to a file your application code imports. A misspelled name then fails in your type checker instead of at run time',
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
    {
      command: 'polar config generate --json',
      description: 'Print what was written as JSON, for scripts and agents',
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
        const flagged = Option.getOrUndefined(out)
        const remembered = rememberedOut(config.input)
        const path =
          flagged ??
          (remembered === undefined ? undefined : join(directory, remembered))
        const chosen =
          requested ??
          (path === undefined ? undefined : languageOfFile(path)) ??
          (yield* detect(fs, [
            ...ancestors(directory),
            ...ancestors(process.cwd()),
          ]))
        const generator = GENERATORS[chosen]
        const extension = extname(generator.file)
        if (path !== undefined && extname(path) !== extension) {
          return yield* new BillingConfigError({
            message: `${path} is not a ${generator.title} file`,
            hint:
              flagged === undefined
                ? `Change ${SETTINGS_KEY}.out in ${config.file} to a path that ends in ${extension}.`
                : `Give --out a path that ends in ${extension}.`,
          })
        }
        const reason = unreadable(config.input)
        if (reason !== undefined) {
          return yield* new BillingConfigError({
            message: `Could not read the names in ${config.file}`,
            hint: `${reason} Run polar config plan to see what to fix.`,
          })
        }
        const target = path ?? join(directory, generator.file)
        const source = generateSource(
          config.input,
          generator,
          basename(config.file),
        )
        const status = yield* generated(fs, target, source, generator, check)
        const stored = relative(directory, target).split(sep).join('/')
        const saved =
          !check &&
          flagged !== undefined &&
          stored !== remembered &&
          extname(config.file) === '.json'
        if (saved) {
          yield* fs
            .writeFileString(config.file, rememberOut(config.source, stored))
            .pipe(
              Effect.mapError(
                (error) =>
                  new BillingConfigError({
                    message: `Could not save ${SETTINGS_KEY}.out in ${config.file}`,
                    hint: error.message,
                  }),
              ),
            )
        }
        const names = namesOf(config.input)
        return {
          config: config.file,
          file: target,
          language: chosen,
          status,
          command: [
            'polar config generate',
            ...(given === undefined ? [] : [given]),
            ...(requested === undefined ? [] : ['--language', requested]),
            ...(flagged === undefined || saved ? [] : ['--out', flagged]),
          ].join(' '),
          saved,
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
