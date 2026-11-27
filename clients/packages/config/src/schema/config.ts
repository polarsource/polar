import { Schema } from 'effect'
import { runtimeConfig } from './runtime'
import { BenefitConfig, flag, credits, slackChannel, custom } from './benefit'
import {
  metadataKey,
  type DeclaredMetadata,
  type MetadataShape,
} from './metadata'
import type { BenefitDefinition, BenefitHelpers } from './benefit'
import {
  checkbox,
  CustomFieldConfig,
  date,
  number,
  select,
  text,
} from './customField'
import type { CustomFieldDefinition, CustomFieldHelpers } from './customField'
import { deprecatedKey } from './deprecation'
import type { Deprecated } from './deprecation'
import {
  createEventReferences,
  event,
  type EventDefinitions,
  type EventHelpers,
  type EventReferences,
  type EventSchemas,
} from './event'
import { meter, MeterConfig } from './meter'
import { Currency } from './money'
import type { MeterDefinition } from './meter'
import { fixed, free, metered, seats, TaxBehavior, tier, units } from './price'
import { product, ProductConfig, productPrices } from './product'
import type { ProductDefinition, ProductHelpers } from './product'
import { visibilityKey } from './visibility'

const ProrationBehavior = Schema.Literals([
  'invoice',
  'prorate',
  'next_period',
  'reset',
  'auto',
])

const Days = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

export const SettingsConfig = Schema.Struct({
  payments: Schema.optionalKey(
    Schema.Struct({
      currency: Schema.optionalKey(Currency),
      tax: Schema.optionalKey(TaxBehavior),
    }),
  ),
  subscriptions: Schema.optionalKey(
    Schema.Struct({
      allow_multiple_subscriptions: Schema.optionalKey(Schema.Boolean),
      proration_behavior: Schema.optionalKey(ProrationBehavior),
      benefit_revocation_grace_period: Schema.optionalKey(Days),
      prevent_trial_abuse: Schema.optionalKey(Schema.Boolean),
    }),
  ),
  customer_portal: Schema.optionalKey(
    Schema.Struct({
      allow_plan_changes: Schema.optionalKey(Schema.Boolean),
      allow_unit_changes: Schema.optionalKey(Schema.Boolean),
      allow_seat_management: Schema.optionalKey(Schema.Boolean),
      allow_pausing: Schema.optionalKey(Schema.Boolean),
      allow_email_changes: Schema.optionalKey(Schema.Boolean),
      show_metered_usage: Schema.optionalKey(Schema.Boolean),
    }),
  ),
  customer_notifications: Schema.optionalKey(
    Schema.Struct({
      send_order_confirmation: Schema.optionalKey(Schema.Boolean),
      send_subscription_confirmation: Schema.optionalKey(Schema.Boolean),
      send_trial_conversion_reminder: Schema.optionalKey(Schema.Boolean),
      send_trial_converted: Schema.optionalKey(Schema.Boolean),
      send_renewal_reminder: Schema.optionalKey(Schema.Boolean),
      send_subscription_cycled: Schema.optionalKey(Schema.Boolean),
      send_card_expiring: Schema.optionalKey(Schema.Boolean),
      send_subscription_past_due: Schema.optionalKey(Schema.Boolean),
      send_subscription_updated: Schema.optionalKey(Schema.Boolean),
      send_subscription_paused: Schema.optionalKey(Schema.Boolean),
      send_subscription_resumed: Schema.optionalKey(Schema.Boolean),
      send_subscription_canceled: Schema.optionalKey(Schema.Boolean),
      send_subscription_uncanceled: Schema.optionalKey(Schema.Boolean),
      send_subscription_revoked: Schema.optionalKey(Schema.Boolean),
    }),
  ),
})

export type SettingsConfig = typeof SettingsConfig.Type

type CamelCase<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<CamelCase<Tail>>}`
  : S

type CamelKeys<T> = {
  readonly [K in keyof T as CamelCase<K & string>]: NonNullable<
    T[K]
  > extends object
    ? CamelKeys<NonNullable<T[K]>>
    : T[K]
}

export type GracePeriod =
  | 'immediately'
  | '2 days'
  | '7 days'
  | '14 days'
  | '21 days'

type SubscriptionsInput = Omit<
  NonNullable<CamelKeys<SettingsConfig>['subscriptions']>,
  'benefitRevocationGracePeriod'
> & {
  /** How long to wait before revoking benefits during payment retries, like `'7 days'` or `'immediately'`. */
  readonly benefitRevocationGracePeriod?: GracePeriod
}

export type SettingsInput = Omit<CamelKeys<SettingsConfig>, 'subscriptions'> & {
  readonly subscriptions?: SubscriptionsInput
}

const snakeKeys = (value: object): object =>
  Object.fromEntries(
    Object.entries(value).map(([name, item]) => [
      name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      typeof item === 'object' && item !== null ? snakeKeys(item) : item,
    ]),
  )

const days = (period: GracePeriod): number =>
  period === 'immediately' ? 0 : Number(period.split(' ')[0])

const settingsJSON = (settings: SettingsInput): object => {
  const period = settings.subscriptions?.benefitRevocationGracePeriod
  return snakeKeys(
    period === undefined
      ? settings
      : {
          ...settings,
          subscriptions: {
            ...settings.subscriptions,
            benefitRevocationGracePeriod: days(period),
          },
        },
  )
}

export const PolarConfig = Schema.Struct({
  settings: Schema.optionalKey(SettingsConfig),
  meters: Schema.Array(MeterConfig),
  custom_fields: Schema.optionalKey(Schema.Array(CustomFieldConfig)),
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
  kind: 'meter' | 'benefit' | 'product' | 'custom field',
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

type CustomFieldEntries =
  | Readonly<Record<string, CustomFieldDefinition>>
  | ReadonlyArray<readonly [slug: string, field: CustomFieldDefinition]>

type CustomFieldKey<CustomFields extends CustomFieldEntries> =
  CustomFields extends ReadonlyArray<
    readonly [infer Key, CustomFieldDefinition]
  >
    ? Key & string
    : keyof CustomFields & string

type SlugCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789-_'

type IsSlug<Key extends string> = string extends Key
  ? true
  : Key extends `${infer Character}${infer Rest}`
    ? SlugCharacters extends `${string}${Character}${string}`
      ? Rest extends ''
        ? true
        : IsSlug<Rest>
      : false
    : false

type ValidCustomFields<CustomFields extends CustomFieldEntries> = ValidEntries<
  CustomFields,
  {
    [Key in CustomFieldKey<CustomFields>]: IsSlug<Key> extends true
      ? unknown
      : DeprecationError<`Custom field key '${Key}' can only use lowercase letters, numbers, - and _.`>
  }
>

type CustomFieldsInput<CustomFields extends CustomFieldEntries> = (
  helpers: CustomFieldHelpers,
) => CustomFields & ValidCustomFields<CustomFields>

type ProductEntries<
  Meter extends string = string,
  Benefit extends string = string,
  Field extends string = string,
> =
  | Readonly<Record<string, ProductDefinition<Meter, Benefit, Benefit, Field>>>
  | ReadonlyArray<
      readonly [
        externalId: string,
        product: ProductDefinition<Meter, Benefit, Benefit, Field>,
      ]
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
> = {
  readonly meters: Readonly<Record<MeterKey<Meters>, MeterConfig>>
  readonly benefits: {
    readonly [Key in BenefitKey<Benefits>]: ConnectedBenefit<
      EntryAt<Benefits, Key>
    >
  }
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
  CustomFields extends CustomFieldEntries,
> = (
  helpers: ProductHelpers<
    MeterKey<Meters>,
    BenefitKey<Benefits>,
    CustomFieldKey<CustomFields>
  >,
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

/** Declares your Polar setup as code: meters, benefits and products. */
export const defineConfig = <
  const Meters extends MeterEntries,
  const Benefits extends BenefitEntries<MeterKey<Meters>> = never,
  const CustomFields extends CustomFieldEntries = never,
  const Products extends ProductEntries<
    MeterKey<Meters>,
    BenefitKey<Benefits>,
    CustomFieldKey<CustomFields>
  > = never,
  Events extends EventDefinitions | undefined = undefined,
>(
  input: {
    /** Organization settings: payment defaults, how subscriptions behave, what customers can do in the customer portal and which emails Polar sends them. A setting you leave out is set to its default, the value a new organization gets. Leave out `settings` to keep the current ones. */
    readonly settings?: SettingsInput
    /** The events your app sends, keyed by name. Meters count them. */
    readonly events?: (helpers: EventHelpers) => Events
    /** What usage to measure, keyed by ID. */
    readonly meters: (helpers: {
      /** Filters and aggregates your events into usage. The name defaults to its key in `meters`. */
      readonly meter: typeof meter<DeclaredEvents<Events>>
      /** Your events and their properties, like `events.call.duration_ms`, for `.on()` and filters. */
      readonly events: EventReferences<DeclaredEvents<Events>>
    }) => Meters
    /** Questions checkout asks, keyed by slug. Products choose which to ask. */
    readonly customFields?: CustomFieldsInput<CustomFields>
    /** What customers get, keyed by ID. Products grant them. */
    readonly benefits?: BenefitsInput<Meters, Benefits>
    /** What customers buy, keyed by ID. */
    readonly products?: ProductsInput<Meters, Benefits, Products, CustomFields>
  } & Present<
    Benefits,
    { readonly benefits: BenefitsInput<Meters, Benefits> }
  > &
    Present<
      CustomFields,
      { readonly customFields: CustomFieldsInput<CustomFields> }
    > &
    Present<
      Products,
      {
        readonly products: ProductsInput<
          Meters,
          Benefits,
          Products,
          CustomFields
        >
      }
    >,
): Config<Meters, Benefits, Events> => {
  const events = input.events?.({ event }) as Events
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
  const benefits = input.benefits?.({ flag, credits, slackChannel, custom })
  const benefitEntries =
    benefits === undefined ? [] : toEntries<BenefitDefinition>(benefits)
  const benefitIds = new Set(benefitEntries.map(([external_id]) => external_id))
  const deprecatedBenefitIds = new Set(
    benefitEntries.flatMap(([external_id, definition]) =>
      definition[deprecatedKey] ? [external_id] : [],
    ),
  )
  const customFields = input.customFields?.({
    text,
    number,
    date,
    checkbox,
    select,
  })
  const customFieldEntries =
    customFields === undefined
      ? []
      : toEntries<CustomFieldDefinition>(customFields)
  const customFieldSlugs = new Set(customFieldEntries.map(([slug]) => slug))
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
  const config = Schema.decodeUnknownSync(PolarConfig, {
    errors: 'all',
    onExcessProperty: 'error',
  })({
    ...(input.settings !== undefined && {
      settings: settingsJSON(input.settings),
    }),
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
    ...(customFields !== undefined && {
      custom_fields: customFieldEntries.map(
        ([slug, { name, type, properties, [metadataKey]: metadata }]) => ({
          type,
          slug,
          name: name ?? slug,
          properties,
          ...(metadata !== undefined && { metadata }),
        }),
      ),
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
        assertKnown(
          owner,
          'custom field',
          customFieldSlugs,
          definition.fieldList.map(({ field }) => field),
        )
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
          ...(definition.fieldList.length > 0 && {
            custom_fields: definition.fieldList,
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
