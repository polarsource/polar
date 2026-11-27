import { Effect, Option, Schema } from 'effect'
import { Command, Flag } from 'effect/cli'
import { BillingConfigError } from '@/schemas/BillingConfig'
import {
  BillingConfig,
  GENERATED_LANGUAGES,
  GENERATORS,
} from '@/services/billing-config/service'
import { plural } from '@/utils/billing-config/problems'
import { output } from '@/utils/command'
import { configFile as file } from '@/utils/flags'
import { fileStatusUsage } from '@/utils/billing-config/usage'
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
    `Where to write the file. Defaults to ${DEFAULT_FILES} next to the config. A file this command did not write is never replaced`,
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
  events: Schema.Finite,
  meters: Schema.Finite,
  benefits: Schema.Finite,
  products: Schema.Finite,
})
type GenerateOutput = typeof GenerateOutput.Type

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
    `${ui.INDENT}${ui.INDENT}${ui.dim(`Import its names in your code. In CI, ${result.command} --check fails when it is out of date.`)}`,
    ui.blank,
  ]
}

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
        const given = Option.getOrUndefined(file)
        const requested = Option.getOrUndefined(language)
        const path = Option.getOrUndefined(out)
        const config = yield* billing.load(given)
        const result = yield* billing.generate(config, {
          language: requested,
          out: path,
          check,
          directory: process.cwd(),
        })
        return {
          config: config.file,
          ...result,
          command: [
            'polar config generate',
            ...(given === undefined ? [] : [given]),
            ...(requested === undefined ? [] : ['--language', requested]),
            ...(path === undefined ? [] : ['--out', path]),
          ].join(' '),
        } satisfies GenerateOutput
      }),
    render,
    failed: (result) => {
      if (result.status !== 'outdated' && result.status !== 'missing') {
        return undefined
      }
      return new BillingConfigError({
        message:
          result.status === 'missing'
            ? `${result.file} has not been generated`
            : `${result.file} is out of date`,
        hint: `Run ${result.command} and commit the result.`,
      })
    },
    telemetry: ({ config, status }) => fileStatusUsage(config, status),
  }),
)
