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

export const loader = (fs: FileSystem.FileSystem) => {
  const findDefault = Effect.gen(function* () {
    for (const name of DEFAULT_CONFIG_FILES) {
      if (yield* exists(fs, name)) return name
    }
    return yield* new BillingConfigError({
      message: NO_CONFIG_FILE,
      hint: `Looked for ${DEFAULT_CONFIG_FILES.join(', ')}. Pass a path to use another file.`,
    })
  })

  return (file?: string): Effect.Effect<LoadedConfig, BillingConfigError> =>
    Effect.gen(function* () {
      const resolved = file ?? (yield* findDefault)
      if (!(yield* exists(fs, resolved))) {
        return yield* new BillingConfigError({
          message: `${resolved} does not exist`,
        })
      }
      const language = languageOf(resolved)
      if (language === undefined) {
        return yield* new BillingConfigError({
          message: `${resolved} is not a supported config file`,
          hint: supportedFiles(),
        })
      }
      return yield* language.load(fs, resolved)
    })
}
