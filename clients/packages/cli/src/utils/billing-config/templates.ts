import { generateConfig } from '@polar-sh/polar'
import { Effect } from 'effect'
import {
  BillingConfigError,
  type ConfigDocument,
} from '@/schemas/BillingConfig'

export const FORMATS = ['ts', 'json'] as const
export type Format = (typeof FORMATS)[number]

export const DEFAULT_FILES: Record<Format, string> = {
  ts: 'polar.config.ts',
  json: 'polar.config.json',
}

export const formatOf = (file: string): Format | undefined =>
  file.endsWith('.json') ? 'json' : file.endsWith('.ts') ? 'ts' : undefined

// Export lists unset fields as null; these two mean "one-time" and stay.
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

export const renderConfig = (format: Format, document: ConfigDocument) => {
  const config = dropOptionalNulls(document)
  return format === 'json'
    ? Effect.succeed(`${JSON.stringify(config, null, 2)}\n`)
    : generateConfig(config).pipe(
        Effect.mapError(
          (error) =>
            new BillingConfigError({
              message: 'This config cannot be written as TypeScript yet',
              hint: `Pass --format json instead. ${error.message.split('\n').slice(0, 2).join(' ')}`,
            }),
        ),
      )
}
