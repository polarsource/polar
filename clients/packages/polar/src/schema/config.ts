import { Schema } from 'effect'
import { runtimeConfig } from './runtime'
import { BenefitConfig, flag, credits } from './benefit'
import {
  metadataKey,
  type DeclaredMetadata,
  type MetadataShape,
} from './metadata'
import type { BenefitDefinition, BenefitHelpers } from './benefit'
import { deprecatedKey } from './deprecation'
import {
  createEventReferences,
  type EventDefinitions,
  type EventReferences,
  type EventSchemas,
  type ValidEvents,
} from './event'
import { discount, DiscountConfig, discountConfig } from './discount'
import type { DiscountDefinition, DiscountHelpers } from './discount'
import { meter, MeterConfig } from './meter'
import { Currency } from './money'
import type { MeterDefinition } from './meter'
import { fixed, free, metered, seats, TaxBehavior, tier, units } from './price'
import { product, ProductConfig, productPrices } from './product'
import type { ProductDefinition, ProductHelpers } from './product'
import { visibilityKey } from './visibility'
import {
  discord,
  endpoint,
  HandledWebhookEndpoint,
  slack,
  WEBHOOK_API_VERSION,
  WebhookEndpointConfig,
} from './webhook'
import type { WebhookEntries, WebhookHelpers } from './webhook'

export const SettingsConfig = Schema.Struct({
  payments: Schema.optionalKey(
    Schema.Struct({
      currency: Schema.optionalKey(Currency),
      tax: Schema.optionalKey(TaxBehavior),
    }),
  ),
})

export type SettingsConfig = typeof SettingsConfig.Type

export const PolarConfig = Schema.Struct({
  settings: Schema.optionalKey(SettingsConfig),
  meters: Schema.Array(MeterConfig),
  benefits: Schema.optionalKey(Schema.Array(BenefitConfig)),
  products: Schema.optionalKey(Schema.Array(ProductConfig)),
  discounts: Schema.optionalKey(Schema.Array(DiscountConfig)),
  webhooks: Schema.optionalKey(Schema.Array(WebhookEndpointConfig)),
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
  kind: 'meter' | 'benefit' | 'product',
  ids: ReadonlySet<string>,
  references: ReadonlyArray<string>,
) => {
  const unknown = references.find((reference) => !ids.has(reference))
  if (unknown !== undefined) {
    throw new Error(`${owner} references unknown ${kind} "${unknown}".`)
  }
}

const assertNotDeprecated = (
  owner: string,
  kind: 'meter' | 'benefit' | 'product',
  deprecated: ReadonlySet<string>,
  references: ReadonlyArray<string>,
) => {
  const reference = references.find((reference) => deprecated.has(reference))
  if (reference !== undefined) {
    throw new Error(
      `${owner} uses ${kind} "${reference}", which is deprecated. Undeprecate the ${kind} or create a new one.`,
    )
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

type BenefitAt<Benefits extends BenefitEntries, Key extends string> =
  Benefits extends ReadonlyArray<infer Entry>
    ? Extract<Entry, readonly [Key, BenefitDefinition]>[1]
    : Benefits[Key & keyof Benefits]

type WithMetadata<Benefit, Values> = Benefit extends unknown
  ? Omit<Benefit, 'metadata'> & { readonly metadata: Values }
  : never

type ConnectedBenefit<Definition> =
  Definition extends DeclaredMetadata<infer Values>
    ? WithMetadata<BenefitConfig, MetadataShape<Values>>
    : BenefitConfig

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

type ProductKey<Products extends ProductEntries> =
  Products extends ReadonlyArray<readonly [infer Key, ProductDefinition]>
    ? Key & string
    : keyof Products & string

type DiscountEntries<Product extends string = string> =
  | Readonly<Record<string, DiscountDefinition<Product>>>
  | ReadonlyArray<
      readonly [externalId: string, discount: DiscountDefinition<Product>]
    >

type ConnectedConfig<
  Meters extends MeterEntries,
  Benefits extends BenefitEntries,
  Events extends EventDefinitions | undefined,
  Webhooks extends WebhookEntries,
> = {
  readonly meters: Readonly<Record<MeterKey<Meters>, MeterConfig>>
  readonly benefits: {
    readonly [Key in BenefitKey<Benefits>]: ConnectedBenefit<
      BenefitAt<Benefits, Key>
    >
  }
  readonly webhooks: Webhooks
} & (Events extends EventDefinitions
  ? { readonly events: Extract<Events, EventSchemas> }
  : unknown)

export interface Config<
  Meters extends MeterEntries = MeterEntries,
  Benefits extends BenefitEntries = BenefitEntries,
  Events extends EventDefinitions | undefined = undefined,
  Webhooks extends WebhookEntries = Record<never, never>,
> {
  readonly toJSON: () => PolarConfig
  readonly [runtimeConfig]: () => ConnectedConfig<
    Meters,
    Benefits,
    Events,
    Webhooks
  >
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
  const Discounts extends DiscountEntries<ProductKey<Products>> = never,
  Events extends EventDefinitions | undefined = undefined,
  const Webhooks extends WebhookEntries = Record<never, never>,
>(input: {
  readonly settings?: SettingsConfig
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
  readonly discounts?: (
    helpers: DiscountHelpers<ProductKey<Products>>,
  ) => Discounts
  readonly webhooks?: (helpers: WebhookHelpers) => Webhooks
}): Config<Meters, Benefits, Events, Webhooks> => {
  const events = input.events as Events
  const entries = toEntries(
    input.meters({
      meter: meter<DeclaredEvents<Events>>,
      events: createEventReferences((events ?? {}) as DeclaredEvents<Events>),
    }),
  )
  const meterIds = new Set(entries.map(([external_id]) => external_id))
  const deprecatedMeterIds = new Set(
    entries.flatMap(([external_id, definition]) =>
      definition.deprecated ? [external_id] : [],
    ),
  )
  const benefits = input.benefits?.({ flag, credits })
  const benefitEntries =
    benefits === undefined ? [] : toEntries<BenefitDefinition>(benefits)
  const benefitIds = new Set(benefitEntries.map(([external_id]) => external_id))
  const deprecatedBenefitIds = new Set(
    benefitEntries.flatMap(([external_id, definition]) =>
      definition[deprecatedKey] ? [external_id] : [],
    ),
  )
  const products = input.products?.({
    product,
    free,
    fixed,
    seats,
    units,
    tier,
    meter: metered,
  })
  const productEntries =
    products === undefined ? [] : toEntries<ProductDefinition>(products)
  const productIds = new Set(productEntries.map(([external_id]) => external_id))
  const discounts = input.discounts?.({ discount })
  const webhooks = input.webhooks?.({ endpoint, slack, discord })
  const webhookEntries = Object.entries(webhooks ?? {})
  const secretEnvs = webhookEntries.flatMap(([, webhook]) =>
    webhook instanceof HandledWebhookEndpoint ? [webhook.secretEnv] : [],
  )
  const sharedSecret = secretEnvs.find(
    (env, index) => secretEnvs.indexOf(env) !== index,
  )
  if (sharedSecret !== undefined) {
    throw new Error(
      `Webhooks with handlers each get their own signing secret, but more than one reads ${sharedSecret}. Give each a different .secret().`,
    )
  }
  const config = Schema.decodeUnknownSync(PolarConfig, {
    errors: 'all',
    onExcessProperty: 'error',
  })({
    ...(input.settings !== undefined && { settings: input.settings }),
    meters: entries.map(([external_id, definition]) => {
      const { name } = validateMeterNaming({
        external_id,
        name: definition.name,
      })
      return { ...definition, external_id, name: name ?? external_id }
    }),
    ...(benefits !== undefined && {
      benefits: benefitEntries.map(
        ([
          external_id,
          {
            name,
            [metadataKey]: metadata,
            [visibilityKey]: visibility,
            [deprecatedKey]: deprecated,
            ...definition
          },
        ]) => {
          validateBenefitNaming({ external_id, name })
          if (definition.type === 'meter_credit') {
            const owner = `Benefit "${external_id}"`
            const references = [definition.properties.meter]
            assertKnown(owner, 'meter', meterIds, references)
            if (!deprecated) {
              assertNotDeprecated(
                owner,
                'meter',
                deprecatedMeterIds,
                references,
              )
            }
          }
          return {
            ...definition,
            external_id,
            description: name ?? external_id,
            ...(metadata !== undefined && { metadata }),
            ...(visibility === 'private' && { visibility }),
            ...(deprecated && { deprecated: true as const }),
          }
        },
      ),
    }),
    ...(products !== undefined && {
      products: productEntries.map(([external_id, definition]) => {
        const { name } = validateProductNaming({
          external_id,
          name: definition.name,
        })
        const owner = `Product "${external_id}"`
        const meterReferences = definition.priceList.flatMap((price) =>
          price.kind === 'metered' ? [price.meter] : [],
        )
        const deprecated = definition[deprecatedKey]
        assertKnown(owner, 'meter', meterIds, meterReferences)
        assertKnown(owner, 'benefit', benefitIds, definition.benefits)
        if (!deprecated) {
          assertNotDeprecated(
            owner,
            'meter',
            deprecatedMeterIds,
            meterReferences,
          )
          assertNotDeprecated(
            owner,
            'benefit',
            deprecatedBenefitIds,
            definition.benefits,
          )
        }
        return {
          external_id,
          name: name ?? external_id,
          ...definition.billing,
          ...definition.trialPeriod,
          ...definition.meterPeriod,
          prices: productPrices(
            external_id,
            definition,
            input.settings?.payments?.currency,
          ),
          benefits: definition.benefits,
          ...(definition[metadataKey] !== undefined && {
            metadata: definition[metadataKey],
          }),
          ...(definition.descriptionText !== undefined && {
            description: definition.descriptionText,
          }),
          ...(definition[visibilityKey] === 'private' && {
            visibility: definition[visibilityKey],
          }),
          ...(deprecated && { deprecated: true as const }),
        }
      }),
    }),
    ...(discounts !== undefined && {
      discounts: toEntries<DiscountDefinition>(discounts).map(
        ([external_id, definition]) => {
          assertKnown(
            `Discount "${external_id}"`,
            'product',
            productIds,
            definition.limits.products ?? [],
          )
          return discountConfig(external_id, definition)
        },
      ),
    }),
    ...(webhooks !== undefined && {
      webhooks: webhookEntries.map(
        ([external_id, { url, format, events }]) => ({
          external_id,
          url,
          format,
          events,
          api_version: WEBHOOK_API_VERSION,
        }),
      ),
    }),
  })

  type Connected = ConnectedConfig<Meters, Benefits, Events, Webhooks>
  return {
    toJSON: () => structuredClone(config),
    [runtimeConfig]: () =>
      ({
        ...(events !== undefined && { events }),
        meters: byExternalId('meter', config.meters),
        benefits: byExternalId('benefit', config.benefits ?? []),
        webhooks: Object.fromEntries(webhookEntries),
      }) as Connected,
  }
}
