import { extname, join } from 'node:path'
import { Effect, type FileSystem } from 'effect'
import type { Format } from '@/schemas/BillingConfig'
import { json } from '@/services/billing-config/languages/json'
import {
  exists,
  findUp,
  type Language,
  type Manifest,
} from '@/services/billing-config/languages/language'
import { typescript } from '@/services/billing-config/languages/typescript'

export type { Language } from '@/services/billing-config/languages/language'
export { exists } from '@/services/billing-config/languages/language'

export const LANGUAGES: ReadonlyArray<Language> = [typescript, json]

const byFormat = Object.fromEntries(
  LANGUAGES.map((language) => [language.format, language]),
) as Record<Format, Language>

export const languageFor = (format: Format): Language => byFormat[format]

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

export interface Project extends Manifest {
  readonly language: Language
}

export const projectsAt = (fs: FileSystem.FileSystem, directory: string) =>
  Effect.gen(function* () {
    const found: Array<Project> = []
    for (const language of LANGUAGES) {
      for (const manifest of language.manifests) {
        if (yield* exists(fs, join(directory, manifest.file))) {
          found.push({ ...manifest, language })
        }
      }
    }
    return found
  })

const filesOf = ({ manifests }: Language) => manifests.map(({ file }) => file)

export const MANIFESTS = LANGUAGES.flatMap(filesOf)

export const projectRoot = (fs: FileSystem.FileSystem, from: string) =>
  findUp(fs, from, MANIFESTS)

export const projectRootFor = (
  fs: FileSystem.FileSystem,
  from: string,
  language: Language,
) => findUp(fs, from, filesOf(language))
