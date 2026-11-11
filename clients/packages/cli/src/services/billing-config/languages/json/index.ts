import { Effect } from 'effect'
import { BillingConfigError, CONFIG_FILES } from '@/schemas/BillingConfig'
import {
  dropOptionalNulls,
  type Language,
  readSource,
} from '@/services/billing-config/languages/language'

export const json: Language = {
  title: 'JSON',
  format: 'json',
  extension: '.json',
  extensions: ['.json'],
  defaultFiles: CONFIG_FILES.json,
  manifest: undefined,
  installer: undefined,
  load: (fs, _run, file) =>
    Effect.gen(function* () {
      const source = yield* readSource(fs, file)
      const input = yield* Effect.try({
        try: () => JSON.parse(source) as unknown,
        catch: (error) =>
          new BillingConfigError({
            message: `${file} is not valid JSON`,
            hint: error instanceof Error ? error.message : String(error),
          }),
      })
      return { file, source, input, generated: false }
    }),
  render: (document) =>
    Effect.succeed(`${JSON.stringify(dropOptionalNulls(document), null, 2)}\n`),
}
