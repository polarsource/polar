import { Effect, type FileSystem } from 'effect'
import {
  BillingConfigError,
  DEFAULT_CONFIG_FILES,
  type LoadedConfig,
  NO_CONFIG_FILE,
} from '@/schemas/BillingConfig'
import {
  exists,
  languageOf,
  supportedFiles,
} from '@/services/billing-config/languages'

export const findConfigFile = (fs: FileSystem.FileSystem, file?: string) =>
  Effect.gen(function* () {
    if (file !== undefined) {
      if (yield* exists(fs, file)) return file
      return yield* new BillingConfigError({
        message: `${file} does not exist`,
      })
    }
    for (const name of DEFAULT_CONFIG_FILES) {
      if (yield* exists(fs, name)) return name
    }
    return yield* new BillingConfigError({
      message: NO_CONFIG_FILE,
      hint: `Looked for ${DEFAULT_CONFIG_FILES.join(', ')}. Pass a path to use another file.`,
    })
  })

export const loader =
  (fs: FileSystem.FileSystem) =>
  (file?: string): Effect.Effect<LoadedConfig, BillingConfigError> =>
    Effect.gen(function* () {
      const resolved = yield* findConfigFile(fs, file)
      const language = languageOf(resolved)
      if (language === undefined) {
        return yield* new BillingConfigError({
          message: `${resolved} is not a supported config file`,
          hint: supportedFiles(),
        })
      }
      return yield* language.load(fs, resolved)
    })
