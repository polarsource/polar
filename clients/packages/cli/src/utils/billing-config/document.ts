import { extname } from 'node:path'
import { generateConfig } from '@polar-sh/polar'
import { Effect } from 'effect'
import {
  BillingConfigError,
  type ConfigDocument,
} from '@/schemas/BillingConfig'

const SCRIPT_EXTENSIONS = new Set(['.ts', '.mts', '.mjs'])

const REQUIRED_NULL_KEYS = new Set([
  'recurring_interval',
  'recurring_interval_count',
])

const dropOptionalNulls = (item: unknown): unknown => {
  if (Array.isArray(item)) return item.map(dropOptionalNulls)
  if (typeof item !== 'object' || item === null) return item
  return Object.fromEntries(
    Object.entries(item)
      .filter(([key, value]) => value !== null || REQUIRED_NULL_KEYS.has(key))
      .map(([key, value]) => [key, dropOptionalNulls(value)]),
  )
}

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
              Array.isArray(items) ? items.map(dropOptionalNulls) : items,
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
