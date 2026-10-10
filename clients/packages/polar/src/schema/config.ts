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
import { fixed, free, metered, seats, tier, units } from './price'
import { product, ProductConfig, productPrices } from './product'
import type { ProductDefinition, ProductHelpers } from './product'

export const PolarConfig = Schema.Struct({
  meters: Schema.Array(MeterConfig),
  benefits: Schema.optionalKey(Schema.Array(BenefitConfig)),
  products: Schema.optionalKey(Schema.Array(ProductConfig)),
})

export type PolarConfig = typeof PolarConfig.Type

export const validateConfig = Schema.decodeUnknownEffect(PolarConfig, {
  errors: 'all',
  onExcessProperty: 'error',
})

const validateNaming = (
  kind: 'meter' | 'benefit' | 'product',
  minimum: number,
  maximum?: number,
) =>
  Schema.decodeUnknownSync(
    Schema.Struct({
      external_id: Schema.String,
      name: Schema.optional(Schema.String),
    }).check(
      Schema.makeFilter(({ external_id, name }) =>
        name !== undefined ||
        (external_id.length >= minimum &&
          (maximum === undefined || external_id.length <= maximum))
          ? undefined
          : {
              path: ['name'],
              issue: `Provide a name for ${kind} "${external_id}" because its key is ${
                maximum === undefined
                  ? `shorter than ${minimum}`
                  : `not between ${minimum} and ${maximum}`
              } characters.`,
            },
      ),
    ),
  )

const validateMeterNaming = validateNaming('meter', 3)
const validateBenefitNaming = validateNaming('benefit', 3, 42)
const validateProductNaming = validateNaming('product', 3, 64)

const assertKnown = (
  owner: string,
  kind: 'meter' | 'benefit',
  ids: ReadonlySet<string>,
  references: ReadonlyArray<string>,
) => {
  const unknown = references.find((reference) => !ids.has(reference))
  if (unknown !== undefined) {
    throw new Error(`${owner} references unknown ${kind} "${unknown}".`)
  }
}

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

type ProductEntries<
  Meter extends string = string,
  Benefit extends string = string,
> =
  | Readonly<Record<string, ProductDefinition<Meter, Benefit>>>
  | ReadonlyArray<
      readonly [externalId: string, product: ProductDefinition<Meter, Benefit>]
    >

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
  const Products extends ProductEntries<
    MeterKey<Meters>,
    BenefitKey<Benefits>
  > = never,
  Events extends EventDefinitions | undefined = undefined,
>(input: {
  readonly events?: Events &
    (Events extends EventDefinitions ? ValidEvents<Events> : unknown)
  readonly meters: (helpers: {
    readonly meter: typeof meter<DeclaredEvents<Events>>
    readonly events: EventReferences<DeclaredEvents<Events>>
  }) => Meters
  readonly benefits?: (helpers: BenefitHelpers<MeterKey<Meters>>) => Benefits
  readonly products?: (
    helpers: ProductHelpers<MeterKey<Meters>, BenefitKey<Benefits>>,
  ) => Products
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
  const benefitEntries =
    benefits === undefined ? [] : toEntries<BenefitDefinition>(benefits)
  const benefitIds = new Set(benefitEntries.map(([external_id]) => external_id))
  const products = input.products?.({
    product,
    free,
    fixed,
    seats,
    units,
    tier,
    meter: metered,
  })
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
      benefits: benefitEntries.map(([external_id, { name, ...definition }]) => {
        validateBenefitNaming({ external_id, name })
        if (definition.type === 'meter_credit') {
          assertKnown(`Benefit "${external_id}"`, 'meter', meterIds, [
            definition.properties.meter,
          ])
        }
        return {
          ...definition,
          external_id,
          description: name ?? external_id,
        }
      }),
    }),
    ...(products !== undefined && {
      products: toEntries<ProductDefinition>(products).map(
        ([external_id, definition]) => {
          const { name } = validateProductNaming({
            external_id,
            name: definition.name,
          })
          const owner = `Product "${external_id}"`
          assertKnown(
            owner,
            'meter',
            meterIds,
            definition.priceList.flatMap((price) =>
              price.kind === 'metered' ? [price.meter] : [],
            ),
          )
          assertKnown(owner, 'benefit', benefitIds, definition.benefits)
          return {
            external_id,
            name: name ?? external_id,
            ...definition.billing,
            ...definition.trialPeriod,
            prices: productPrices(external_id, definition),
            benefits: definition.benefits,
            ...(definition.descriptionText !== undefined && {
              description: definition.descriptionText,
            }),
            ...(definition.visibilityLevel !== undefined && {
              visibility: definition.visibilityLevel,
            }),
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
