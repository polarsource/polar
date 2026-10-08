import { Schema } from 'effect'
import { RuntimeSDK, type RuntimeConnection } from '../runtime'
import type { PolarOptions } from '../sdk'
import type { RuntimeBenefitConfig } from './runtime'
import { BenefitConfig, flag, credits } from './benefit'
import type { BenefitDefinition, BenefitHelpers } from './benefit'
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

const validateBenefitNaming = Schema.decodeUnknownSync(
  Schema.Struct({
    external_id: Schema.String,
    displayName: Schema.optional(Schema.String),
  }).check(
    Schema.makeFilter(({ external_id, displayName }) =>
      displayName !== undefined ||
      (external_id.length >= 3 && external_id.length <= 42)
        ? undefined
        : {
            path: ['displayName'],
            issue: `Provide a displayName for benefit "${external_id}" because its key is not between 3 and 42 characters.`,
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

type ConnectedConfig<
  Meters extends MeterEntries,
  Benefits extends BenefitEntries,
> = {
  readonly meters: Readonly<Record<MeterKey<Meters>, MeterConfig>>
  readonly benefits: Readonly<
    Record<BenefitKey<Benefits>, BenefitConfig & RuntimeBenefitConfig>
  >
}

export interface Config<
  Meters extends MeterEntries = MeterEntries,
  Benefits extends BenefitEntries = BenefitEntries,
> {
  readonly toJSON: () => PolarConfig
  readonly connect: (
    options: PolarOptions,
  ) => RuntimeConnection<ConnectedConfig<Meters, Benefits>>
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
>(input: {
  readonly meters: (helpers: { readonly meter: typeof meter }) => Meters
  readonly benefits?: (helpers: BenefitHelpers<MeterKey<Meters>>) => Benefits
}): Config<Meters, Benefits> => {
  const entries = toEntries(input.meters({ meter }))
  const meterIds = new Set(entries.map(([external_id]) => external_id))
  const benefits = input.benefits?.({ flag, credits })
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
    ...(benefits !== undefined && {
      benefits: toEntries<BenefitDefinition>(benefits).map(
        ([external_id, { name, ...definition }]) => {
          const { displayName } = validateBenefitNaming({
            external_id,
            displayName: name,
          })
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
            description: displayName ?? external_id,
          }
        },
      ),
    }),
  })

  return {
    toJSON: () => structuredClone(config),
    connect: (options) =>
      RuntimeSDK(
        {
          meters: byExternalId('meter', config.meters) as ConnectedConfig<
            Meters,
            Benefits
          >['meters'],
          benefits: byExternalId(
            'benefit',
            config.benefits ?? [],
          ) as ConnectedConfig<Meters, Benefits>['benefits'],
        },
        options,
      ),
  }
}
