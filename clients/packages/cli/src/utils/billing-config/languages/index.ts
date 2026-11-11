import { extname, join } from 'node:path'
import { Effect, type FileSystem } from 'effect'
import type { Format } from '@/schemas/BillingConfig'
import { json } from '@/utils/billing-config/languages/json'
import {
  exists,
  findUp,
  type Language,
  type Loader,
} from '@/utils/billing-config/languages/language'
import { python } from '@/utils/billing-config/languages/python'
import { typescript } from '@/utils/billing-config/languages/typescript'

export type { Language } from '@/utils/billing-config/languages/language'
export { exists } from '@/utils/billing-config/languages/language'

export const LANGUAGES: ReadonlyArray<Language> = [typescript, json]

const LOADERS: ReadonlyArray<Loader> = [typescript, python, json]

const byFormat = Object.fromEntries(
  LANGUAGES.map((language) => [language.format, language]),
) as Record<Format, Language>

export const languageFor = (format: Format): Language => byFormat[format]

export const DEFAULT_CONFIG_FILES: ReadonlyArray<string> = LOADERS.flatMap(
  (loader) => loader.defaultFiles,
)

export const languageOf = (file: string): Loader | undefined =>
  extname(file) === ''
    ? json
    : LOADERS.find((loader) =>
        loader.extensions.some((extension) => file.endsWith(extension)),
      )

export const writableLanguageOf = (file: string): Language | undefined =>
  LANGUAGES.find((language) => file.endsWith(language.extension))

export const supportedFiles = () =>
  `Use a ${LOADERS.map(({ extensions }) => extensions[0]).join(', ')} or .js file.`

export const languageAt = (fs: FileSystem.FileSystem, directory: string) =>
  Effect.gen(function* () {
    for (const language of LANGUAGES) {
      if (
        language.manifest !== undefined &&
        (yield* exists(fs, join(directory, language.manifest)))
      ) {
        return language
      }
    }
    return undefined
  })

const MANIFESTS = LANGUAGES.flatMap((language) =>
  language.manifest === undefined ? [] : [language.manifest],
)

export const projectRoot = (fs: FileSystem.FileSystem, from: string) =>
  findUp(fs, from, MANIFESTS)

export const projectRootFor = (
  fs: FileSystem.FileSystem,
  from: string,
  language: Language,
) =>
  language.manifest === undefined
    ? Effect.succeed(undefined)
    : findUp(fs, from, [language.manifest])
