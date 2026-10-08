import { extname } from 'node:path'
import { generateConfig } from '@polar-sh/polar'
import { Effect } from 'effect'
import {
  BillingConfigError,
  type ConfigDocument,
} from '@/schemas/BillingConfig'
import { compact } from '@/utils/billing-config/compare'

const SCRIPT_EXTENSIONS = new Set(['.ts', '.mts', '.mjs'])

export const renderDocument = (file: string, document: ConfigDocument) =>
  extname(file) === '.json'
    ? Effect.succeed(`${JSON.stringify(document, null, 2)}\n`)
    : !SCRIPT_EXTENSIONS.has(extname(file))
      ? Effect.fail(
          new BillingConfigError({
            message: `${file} is not a file pull can write`,
            hint: 'Use a .ts, .mts, .mjs or .json path.',
          }),
        )
      : generateConfig(
          Object.fromEntries(
            Object.entries(document).map(([section, items]) => [
              section,
              items.map(compact),
            ]),
          ),
        ).pipe(
          Effect.mapError(
            (error) =>
              new BillingConfigError({
                message: 'This config cannot be written as TypeScript yet',
                hint: `Pull to a .json file instead. ${error.message.split('\n').slice(0, 2).join(' ')}`,
              }),
          ),
        )
