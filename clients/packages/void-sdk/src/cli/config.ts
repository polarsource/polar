import { Schema } from 'effect'
import type { Config } from '../config/config'

/** Imports a config module by URL; the CLI's entry point supplies `import`. */
export type Loader = (url: string) => Promise<Record<string, unknown>>

/** The config module could not be found, loaded, or does not export a config. */
export class ConfigError extends Schema.TaggedError<ConfigError>()(
  'ConfigError',
  {
    path: Schema.String,
    message: Schema.String,
    cause: Schema.optionalKey(Schema.Defect()),
  },
) {}

export const isConfig = (value: unknown): value is Config =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  value.kind === 'config'
