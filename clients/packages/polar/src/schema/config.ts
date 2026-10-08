import { Schema } from 'effect'
import { RuntimeSDK, type RuntimeConnection } from '../runtime'
import type { PolarOptions } from '../sdk'
import {
  createEventReferences,
  type EventDefinitions,
  type EventReferences,
  type EventSchemas,
  type ValidEvents,
} from './event'
import { meter, MeterConfig } from './meter'
import type { MeterDefinition } from './meter'

export const PolarConfig = Schema.Struct({
  meters: Schema.Array(MeterConfig),
})

export type PolarConfig = typeof PolarConfig.Type

export const validateConfig = Schema.decodeUnknownEffect(PolarConfig, {
  errors: 'all',
  onExcessProperty: 'error',
})

const validateMeterNaming = Schema.decodeUnknownSync(
  Schema.Struct({
    external_id: Schema.String,
    displayName: Schema.optional(Schema.String),
  }).check(
    Schema.makeFilter(({ external_id, displayName }) =>
      displayName !== undefined || external_id.length >= 3
        ? undefined
        : {
            path: ['displayName'],
            issue: `Provide a displayName for meter "${external_id}" because its key is shorter than 3 characters.`,
          },
    ),
  ),
)

type MeterEntries =
  | Readonly<Record<string, MeterDefinition>>
  | ReadonlyArray<readonly [externalId: string, meter: MeterDefinition]>

type MeterKey<Meters extends MeterEntries> =
  Meters extends ReadonlyArray<readonly [infer Key, MeterDefinition]>
    ? Key & string
    : keyof Meters & string

type DeclaredEvents<Events extends EventDefinitions | undefined> =
  Events extends EventDefinitions ? Events : Record<never, never>

type ConnectedConfig<
  Meters extends MeterEntries,
  Events extends EventDefinitions | undefined,
> = {
  readonly meters: Readonly<Record<MeterKey<Meters>, MeterConfig>>
} & (Events extends EventDefinitions
  ? { readonly events: Extract<Events, EventSchemas> }
  : unknown)

export interface Config<
  Meters extends MeterEntries = MeterEntries,
  Events extends EventDefinitions | undefined = undefined,
> {
  readonly toJSON: () => PolarConfig
  readonly connect: (
    options: PolarOptions,
  ) => RuntimeConnection<ConnectedConfig<Meters, Events>>
}

export const defineConfig = <
  const Meters extends MeterEntries,
  Events extends EventDefinitions | undefined = undefined,
>(input: {
  readonly events?: Events &
    (Events extends EventDefinitions ? ValidEvents<Events> : unknown)
  readonly meters: (helpers: {
    readonly meter: typeof meter<DeclaredEvents<Events>>
    readonly events: EventReferences<DeclaredEvents<Events>>
  }) => Meters
}): Config<Meters, Events> => {
  const events = input.events as Events
  const definitions = input.meters({
    meter: meter<DeclaredEvents<Events>>,
    events: createEventReferences((events ?? {}) as DeclaredEvents<Events>),
  })
  const entries = Array.isArray(definitions)
    ? definitions
    : Object.entries(definitions)
  const config = Schema.decodeUnknownSync(PolarConfig, {
    errors: 'all',
    onExcessProperty: 'error',
  })({
    meters: entries.map(([external_id, definition]) => {
      const { displayName } = validateMeterNaming({
        external_id,
        displayName: definition.name,
      })
      return { ...definition, external_id, name: displayName ?? external_id }
    }),
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
      const typedMeters = meters as ConnectedConfig<Meters, Events>['meters']
      return RuntimeSDK(
        (events === undefined
          ? { meters: typedMeters }
          : { events, meters: typedMeters }) as ConnectedConfig<Meters, Events>,
        options,
      )
    },
  }
}
