import { extname, join } from 'node:path'
import { Effect, type FileSystem } from 'effect'
import type { Format } from '@/schemas/BillingConfig'
import { json } from '@/utils/billing-config/languages/json'
import {
  exists,
  findUp,
  type Language,
} from '@/utils/billing-config/languages/language'
import { python } from '@/utils/billing-config/languages/python'
import { typescript } from '@/utils/billing-config/languages/typescript'

export type { Language } from '@/utils/billing-config/languages/language'
export { exists } from '@/utils/billing-config/languages/language'

export const LANGUAGES: ReadonlyArray<Language> = [typescript, python, json]

const byFormat = Object.fromEntries(
  LANGUAGES.map((language) => [language.format, language]),
) as Record<Format, Language>

export const languageFor = (format: Format): Language => byFormat[format]

export const DEFAULT_CONFIG_FILES: ReadonlyArray<string> = LANGUAGES.flatMap(
  (language) => language.defaultFiles,
)

export const languageOf = (file: string): Language | undefined =>
  extname(file) === ''
    ? json
    : LANGUAGES.find((language) =>
        language.extensions.some((extension) => file.endsWith(extension)),
      )

export const writableLanguageOf = (file: string): Language | undefined =>
  LANGUAGES.find((language) => file.endsWith(language.extension))

export const supportedFiles = () =>
  `Use a ${LANGUAGES.map(({ extension }) => extension).join(', ')} or .js file.`

export const languagesAt = (fs: FileSystem.FileSystem, directory: string) =>
  Effect.gen(function* () {
    const found: Array<Language> = []
    for (const language of LANGUAGES) {
      if (
        language.manifest !== undefined &&
        (yield* exists(fs, join(directory, language.manifest)))
      ) {
        found.push(language)
      }
    }
    return found
  })

export const MANIFESTS = LANGUAGES.flatMap((language) =>
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
