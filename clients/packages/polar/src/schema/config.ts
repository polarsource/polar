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
import type { Deprecated } from './deprecation'
import {
  createEventReferences,
  type EventDefinitions,
  type EventReferences,
  type EventSchemas,
  type ValidEvents,
} from './event'
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

type EntryAt<Entries, Key extends string> =
  Entries extends ReadonlyArray<infer Entry>
    ? Extract<Entry, readonly [Key, unknown]>[1]
    : Entries[Key & keyof Entries]

// Intersected with a config section's entries: `Checks` holds what each
// entry must also satisfy, by external ID.
type ValidEntries<Entries, Checks> =
  Entries extends ReadonlyArray<unknown>
    ? {
        readonly [Index in keyof Entries]: Entries[Index] extends readonly [
          infer Key,
          unknown,
        ]
          ? readonly [Key, Checks[Key & keyof Checks]]
          : Entries[Index]
      }
    : { readonly [Key in keyof Entries]: Checks[Key & keyof Checks] }

type DeprecatedMeterKey<Meters extends MeterEntries> = {
  [Key in MeterKey<Meters>]: EntryAt<Meters, Key> extends Deprecated
    ? Key
    : never
}[MeterKey<Meters>]

// Deprecated references, as keys an entry must have. A definition never has
// them, so the type error leads with the message: "Property '<message>' is
// missing". TypeScript has no custom type errors, so this stands in for one.
type DeprecationError<Message extends string> = {
  readonly [Key in Message]: true
}

type DeprecatedMeterIssue<
  Meter extends string,
  Owner extends string,
> = `Meter '${Meter}' is deprecated, so only a deprecated ${Owner} can use it.`

// Only deprecated benefits can use a deprecated meter.
type ActiveMeter<
  Benefit,
  DeprecatedMeter extends string,
> = Benefit extends Deprecated
  ? unknown
  : Benefit extends {
        readonly properties: { readonly meter: infer Meter extends string }
      }
    ? DeprecationError<
        DeprecatedMeterIssue<Extract<Meter, DeprecatedMeter>, 'benefit'>
      >
    : unknown

type ValidBenefits<
  Benefits extends BenefitEntries,
  DeprecatedMeter extends string,
> = ValidEntries<
  Benefits,
  {
    [Key in BenefitKey<Benefits>]: ActiveMeter<
      EntryAt<Benefits, Key>,
      DeprecatedMeter
    >
  }
>

type BenefitEntries<Meter extends string = string> =
  | Readonly<Record<string, BenefitDefinition<Meter>>>
  | ReadonlyArray<
      readonly [externalId: string, benefit: BenefitDefinition<Meter>]
    >

type BenefitKey<Benefits extends BenefitEntries> =
  Benefits extends ReadonlyArray<readonly [infer Key, BenefitDefinition]>
    ? Key & string
    : keyof Benefits & string

type WithMetadata<Benefit, Values> = Benefit extends unknown
  ? Omit<Benefit, 'metadata'> & { readonly metadata: Values }
  : never

type DeprecatedBenefitKey<Benefits extends BenefitEntries> = {
  [Key in BenefitKey<Benefits>]: EntryAt<Benefits, Key> extends Deprecated
    ? Key
    : never
}[BenefitKey<Benefits>]

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

type ProductGrant<Product> =
  Product extends ProductDefinition<string, string, infer Granted>
    ? Granted
    : never

type PricedMeter<Product> = Product extends {
  readonly priceList: ReadonlyArray<infer Price>
}
  ? Price extends { readonly kind: 'metered'; readonly meter: infer Meter }
    ? Meter & string
    : never
  : never

// Only deprecated products can grant deprecated benefits or price by a
// deprecated meter.
type ActiveProduct<
  Product,
  DeprecatedBenefit extends string,
  DeprecatedMeter extends string,
> = Product extends Deprecated
  ? unknown
  : DeprecationError<
      | `Benefit '${Extract<ProductGrant<Product>, DeprecatedBenefit>}' is deprecated, so only a deprecated product can grant it.`
      | DeprecatedMeterIssue<
          Extract<PricedMeter<Product>, DeprecatedMeter>,
          'product'
        >
    >

type ValidProducts<
  Products extends ProductEntries,
  DeprecatedBenefit extends string,
  DeprecatedMeter extends string,
> = ValidEntries<
  Products,
  {
    [Key in ProductKey<Products>]: ActiveProduct<
      EntryAt<Products, Key>,
      DeprecatedBenefit,
      DeprecatedMeter
    >
  }
>

type ProductKey<Products extends ProductEntries> =
  Products extends ReadonlyArray<readonly [infer Key, ProductDefinition]>
    ? Key & string
    : keyof Products & string

type ConnectedConfig<
  Meters extends MeterEntries,
  Benefits extends BenefitEntries,
  Events extends EventDefinitions | undefined,
  Webhooks extends WebhookEntries,
> = {
  readonly meters: Readonly<Record<MeterKey<Meters>, MeterConfig>>
  readonly benefits: {
    readonly [Key in BenefitKey<Benefits>]: ConnectedBenefit<
      EntryAt<Benefits, Key>
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

type BenefitsInput<
  Meters extends MeterEntries,
  Benefits extends BenefitEntries,
> = (
  helpers: BenefitHelpers<MeterKey<Meters>>,
) => Benefits & ValidBenefits<Benefits, DeprecatedMeterKey<Meters>>

type ProductsInput<
  Meters extends MeterEntries,
  Benefits extends BenefitEntries,
  Products extends ProductEntries,
> = (
  helpers: ProductHelpers<MeterKey<Meters>, BenefitKey<Benefits>>,
) => Products &
  ValidProducts<
    Products,
    DeprecatedBenefitKey<Benefits>,
    DeprecatedMeterKey<Meters>
  >

// TypeScript only points an error at the offending entry, rather than at the
// whole section, when the section's key is required. So once a section is
// given, this repeats its key as required.
type Present<Entries, Section> = [Entries] extends [never] ? unknown : Section

export const defineConfig = <
  const Meters extends MeterEntries,
  const Benefits extends BenefitEntries<MeterKey<Meters>> = never,
  const Products extends ProductEntries<
    MeterKey<Meters>,
    BenefitKey<Benefits>
  > = never,
  Events extends EventDefinitions | undefined = undefined,
  const Webhooks extends WebhookEntries = Record<never, never>,
>(
  input: {
    readonly settings?: SettingsConfig
    readonly events?: Events &
      (Events extends EventDefinitions ? ValidEvents<Events> : unknown)
    readonly meters: (helpers: {
      readonly meter: typeof meter<DeclaredEvents<Events>>
      readonly events: EventReferences<DeclaredEvents<Events>>
    }) => Meters
    readonly benefits?: BenefitsInput<Meters, Benefits>
    readonly products?: ProductsInput<Meters, Benefits, Products>
    readonly webhooks?: (helpers: WebhookHelpers) => Webhooks
  } & Present<
    Benefits,
    { readonly benefits: BenefitsInput<Meters, Benefits> }
  > &
    Present<
      Products,
      { readonly products: ProductsInput<Meters, Benefits, Products> }
    >,
): Config<Meters, Benefits, Events, Webhooks> => {
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
      definition[deprecatedKey] ? [external_id] : [],
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
    meters: entries.map(
      ([
        external_id,
        { [metadataKey]: metadata, [deprecatedKey]: deprecated, ...definition },
      ]) => {
        const { name } = validateMeterNaming({
          external_id,
          name: definition.name,
        })
        return {
          ...definition,
          external_id,
          name: name ?? external_id,
          ...(metadata !== undefined && { metadata }),
          ...(deprecated && { deprecated: true as const }),
        }
      },
    ),
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
