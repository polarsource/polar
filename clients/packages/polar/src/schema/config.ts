import { Schema } from 'effect'
import { fold, MeterConfig } from './meter'
import type { MeterDefinition } from './meter'

export const PolarConfig = Schema.Struct({
  meters: Schema.Array(MeterConfig),
})

export type PolarConfig = typeof PolarConfig.Type

export const validateConfig = Schema.decodeUnknownEffect(PolarConfig, {
  errors: 'all',
  onExcessProperty: 'error',
})

type MeterEntries =
  | Readonly<Record<string, MeterDefinition>>
  | ReadonlyArray<readonly [externalId: string, meter: MeterDefinition]>

export interface Config {
  readonly toJSON: () => PolarConfig
}

export const defineConfig = (input: {
  readonly meters: (helpers: { readonly fold: typeof fold }) => MeterEntries
}): Config => {
  const definitions = input.meters({ fold })
  const entries = Array.isArray(definitions)
    ? definitions
    : Object.entries(definitions)
  const config = Schema.decodeUnknownSync(PolarConfig, {
    errors: 'all',
    onExcessProperty: 'error',
  })({
    meters: entries.map(([external_id, meter]) => ({ ...meter, external_id })),
  })

  return { toJSON: () => structuredClone(config) }
}
