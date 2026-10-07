import { Schema } from 'effect'
import { RuntimeSDK, type RuntimeConnection } from '../runtime'
import type { PolarOptions } from '../sdk'
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

type MeterKey<Meters extends MeterEntries> =
  Meters extends ReadonlyArray<readonly [infer Key, MeterDefinition]>
    ? Key & string
    : keyof Meters & string

type ConnectedConfig<Meters extends MeterEntries> = {
  readonly meters: Readonly<Record<MeterKey<Meters>, MeterConfig>>
}

export interface Config<Meters extends MeterEntries = MeterEntries> {
  readonly toJSON: () => PolarConfig
  readonly connect: (
    options: PolarOptions,
  ) => RuntimeConnection<ConnectedConfig<Meters>>
}

export const defineConfig = <const Meters extends MeterEntries>(input: {
  readonly meters: (helpers: { readonly fold: typeof fold }) => Meters
}): Config<Meters> => {
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

  return {
    toJSON: () => structuredClone(config),
    connect: (options) => {
      const meters = Object.fromEntries(
        structuredClone(config.meters).map((meter) => [
          meter.external_id,
          meter,
        ]),
      )
      if (Object.keys(meters).length !== config.meters.length) {
        throw new Error(
          'Cannot connect a config with duplicate meter external IDs.',
        )
      }
      return RuntimeSDK(
        { meters: meters as ConnectedConfig<Meters>['meters'] },
        options,
      )
    },
  }
}
