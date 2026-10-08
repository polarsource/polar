import { Schema } from 'effect'
import { runtimeConfig, type RuntimeBenefitConfig } from './runtime'
import { BenefitConfig, flag, credits } from './benefit'
import type { BenefitDefinition, BenefitHelpers } from './benefit'
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
  benefits: Schema.optionalKey(Schema.Array(BenefitConfig)),
})

export type PolarConfig = typeof PolarConfig.Type

export const validateConfig = Schema.decodeUnknownEffect(PolarConfig, {
  errors: 'all',
  onExcessProperty: 'error',
})

const validateMeterNaming = Schema.decodeUnknownSync(
  Schema.Struct({
    external_id: Schema.String,
    name: Schema.optional(Schema.String),
  }).check(
    Schema.makeFilter(({ external_id, name }) =>
      name !== undefined || external_id.length >= 3
        ? undefined
        : {
            path: ['name'],
            issue: `Provide a name for meter "${external_id}" because its key is shorter than 3 characters.`,
          },
    ),
  ),
)

const validateBenefitNaming = Schema.decodeUnknownSync(
  Schema.Struct({
    external_id: Schema.String,
    name: Schema.optional(Schema.String),
  }).check(
    Schema.makeFilter(({ external_id, name }) =>
      name !== undefined ||
      (external_id.length >= 3 && external_id.length <= 42)
        ? undefined
        : {
            path: ['name'],
            issue: `Provide a name for benefit "${external_id}" because its key is not between 3 and 42 characters.`,
          },
    ),
  ),
)

const toEntries = <Definition>(
  definitions:
    | Readonly<Record<string, Definition>>
    | ReadonlyArray<readonly [string, Definition]>,
): ReadonlyArray<readonly [string, Definition]> =>
  Array.isArray(definitions) ? definitions : Object.entries(definitions)

type MeterEntries =
  | Readonly<Record<string, MeterDefinition>>
  | ReadonlyArray<readonly [externalId: string, meter: MeterDefinition]>

type MeterKey<Meters extends MeterEntries> =
  Meters extends ReadonlyArray<readonly [infer Key, MeterDefinition]>
    ? Key & string
    : keyof Meters & string

type BenefitEntries<Meter extends string = string> =
  | Readonly<Record<string, BenefitDefinition<Meter>>>
  | ReadonlyArray<
      readonly [externalId: string, benefit: BenefitDefinition<Meter>]
    >

type BenefitKey<Benefits extends BenefitEntries> =
  Benefits extends ReadonlyArray<readonly [infer Key, BenefitDefinition]>
    ? Key & string
    : keyof Benefits & string

type DeclaredEvents<Events extends EventDefinitions | undefined> =
  Events extends EventDefinitions ? Events : Record<never, never>

type ConnectedConfig<
  Meters extends MeterEntries,
  Benefits extends BenefitEntries,
  Events extends EventDefinitions | undefined,
> = {
  readonly meters: Readonly<Record<MeterKey<Meters>, MeterConfig>>
  readonly benefits: Readonly<
    Record<BenefitKey<Benefits>, BenefitConfig & RuntimeBenefitConfig>
  >
} & (Events extends EventDefinitions
  ? { readonly events: Extract<Events, EventSchemas> }
  : unknown)

export interface Config<
  Meters extends MeterEntries = MeterEntries,
  Benefits extends BenefitEntries = BenefitEntries,
  Events extends EventDefinitions | undefined = undefined,
> {
  readonly toJSON: () => PolarConfig
  readonly [runtimeConfig]: () => ConnectedConfig<Meters, Benefits, Events>
}

const byExternalId = <Resource extends { readonly external_id: string }>(
  kind: 'meter' | 'benefit',
  resources: ReadonlyArray<Resource>,
): Record<string, Resource> => {
  const byId = Object.fromEntries(
    structuredClone(resources).map((resource) => [
      resource.external_id,
      resource,
    ]),
  )
  if (Object.keys(byId).length !== resources.length) {
    throw new Error(
      `Cannot connect a config with duplicate ${kind} external IDs.`,
    )
  }
  return byId
}

export const defineConfig = <
  const Meters extends MeterEntries,
  const Benefits extends BenefitEntries<MeterKey<Meters>> = never,
  Events extends EventDefinitions | undefined = undefined,
>(input: {
  readonly events?: Events &
    (Events extends EventDefinitions ? ValidEvents<Events> : unknown)
  readonly meters: (helpers: {
    readonly meter: typeof meter<DeclaredEvents<Events>>
    readonly events: EventReferences<DeclaredEvents<Events>>
  }) => Meters
  readonly benefits?: (helpers: BenefitHelpers<MeterKey<Meters>>) => Benefits
}): Config<Meters, Benefits, Events> => {
  const events = input.events as Events
  const entries = toEntries(
    input.meters({
      meter: meter<DeclaredEvents<Events>>,
      events: createEventReferences((events ?? {}) as DeclaredEvents<Events>),
    }),
  )
  const meterIds = new Set(entries.map(([external_id]) => external_id))
  const benefits = input.benefits?.({ flag, credits })
  const config = Schema.decodeUnknownSync(PolarConfig, {
    errors: 'all',
    onExcessProperty: 'error',
  })({
    meters: entries.map(([external_id, definition]) => {
      const { name } = validateMeterNaming({
        external_id,
        name: definition.name,
      })
      return { ...definition, external_id, name: name ?? external_id }
    }),
    ...(benefits !== undefined && {
      benefits: toEntries<BenefitDefinition>(benefits).map(
        ([external_id, { name, ...definition }]) => {
          validateBenefitNaming({ external_id, name })
          if (
            definition.type === 'meter_credit' &&
            !meterIds.has(definition.properties.meter_external_id)
          ) {
            throw new Error(
              `Benefit "${external_id}" references unknown meter "${definition.properties.meter_external_id}".`,
            )
          }
          return {
            ...definition,
            external_id,
            description: name ?? external_id,
          }
        },
      ),
    }),
  })

  type Connected = ConnectedConfig<Meters, Benefits, Events>
  return {
    toJSON: () => structuredClone(config),
    [runtimeConfig]: () =>
      ({
        ...(events !== undefined && { events }),
        meters: byExternalId('meter', config.meters),
        benefits: byExternalId('benefit', config.benefits ?? []),
      }) as Connected,
  }
}
