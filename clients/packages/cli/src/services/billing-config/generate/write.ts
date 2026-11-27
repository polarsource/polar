import { basename, dirname, extname, join, resolve } from 'node:path'
import { Effect, type FileSystem } from 'effect'
import { BillingConfigError, type LoadedConfig } from '@/schemas/BillingConfig'
import {
  GENERATED_LANGUAGES,
  type GeneratedLanguage,
  GENERATORS,
} from '@/services/billing-config/generate'
import {
  generate,
  type Generator,
  isGenerated,
} from '@/services/billing-config/generate/contract'
import { namesOf, unreadable } from '@/services/billing-config/generate/names'
import { ancestors, exists } from '@/services/billing-config/languages/language'

export interface GenerateOptions {
  readonly language: GeneratedLanguage | undefined
  readonly out: string | undefined
  readonly check: boolean
  readonly directory: string
}

export interface Generated {
  readonly file: string
  readonly language: GeneratedLanguage
  readonly status: 'written' | 'unchanged' | 'outdated' | 'missing'
  readonly events: number
  readonly meters: number
  readonly benefits: number
  readonly products: number
}

const languageOfFile = (path: string) =>
  GENERATED_LANGUAGES.find(
    (language) => extname(GENERATORS[language].file) === extname(path),
  )

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
      if (yield* exists(fs, path)) return language
    }
    return yield* new BillingConfigError({
      message: 'Could not tell which language to generate',
      hint: `Pass --language with one of: ${GENERATED_LANGUAGES.join(', ')}.`,
    })
  })

const save = (
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

export const write =
  (fs: FileSystem.FileSystem) =>
  (
    config: LoadedConfig,
    { language, out, check, directory }: GenerateOptions,
  ) =>
    Effect.gen(function* () {
      const chosen =
        language ??
        (out === undefined ? undefined : languageOfFile(out)) ??
        (yield* detect(fs, [
          ...ancestors(resolve(dirname(config.file))),
          ...ancestors(resolve(directory)),
        ]))
      const generator: Generator = GENERATORS[chosen]
      const extension = extname(generator.file)
      if (out !== undefined && extname(out) !== extension) {
        return yield* new BillingConfigError({
          message: `${out} is not a ${generator.title} file`,
          hint: `Give --out a path that ends in ${extension}.`,
        })
      }
      const reason = unreadable(config.input)
      if (reason !== undefined) {
        return yield* new BillingConfigError({
          message: `Could not read the names in ${config.file}`,
          hint: `${reason} Run polar config validate to see what to fix.`,
        })
      }
      const file = out ?? join(dirname(config.file), generator.file)
      const source = generate(config.input, generator, basename(config.file))
      const names = namesOf(config.input)
      return {
        file,
        language: chosen,
        status: yield* save(fs, file, source, generator, check),
        events: names.events.length,
        meters: names.meters.length,
        benefits: names.benefits.length,
        products: names.products.length,
      } satisfies Generated
    })
