import { Schema } from 'effect'

const benefitFields = {
  external_id: Schema.String.check(Schema.isMinLength(1)),
  description: Schema.String.check(
    Schema.isMinLength(3),
    Schema.isMaxLength(42),
  ),
}

export const BenefitConfig = Schema.Union([
  Schema.Struct({
    ...benefitFields,
    type: Schema.Literal('feature_flag'),
    properties: Schema.Struct({}),
  }),
  Schema.Struct({
    ...benefitFields,
    type: Schema.Literal('meter_credit'),
    properties: Schema.Struct({
      meter_external_id: Schema.String.check(Schema.isMinLength(1)),
      units: Schema.Int.check(
        Schema.isGreaterThan(0),
        Schema.isLessThanOrEqualTo(2147483647),
      ),
      rollover: Schema.Boolean,
    }),
  }),
])

export type BenefitConfig = typeof BenefitConfig.Type

type BenefitOptions = { readonly displayName?: string }

export type BenefitDefinition<Meter extends string = string> =
  | {
      readonly name: string | undefined
      readonly type: 'feature_flag'
      readonly properties: Record<string, never>
    }
  | {
      readonly name: string | undefined
      readonly type: 'meter_credit'
      readonly properties: {
        readonly meter_external_id: Meter
        readonly units: number
        readonly rollover: boolean
      }
    }

export const flag = (
  options: BenefitOptions = {},
): BenefitDefinition<never> => ({
  name: options.displayName,
  type: 'feature_flag',
  properties: {},
})

class CreditsDefinition<Meter extends string> {
  readonly type = 'meter_credit'

  constructor(
    readonly name: string | undefined,
    readonly properties: {
      readonly meter_external_id: Meter
      readonly units: number
      readonly rollover: boolean
    },
  ) {}

  rollover(): CreditsDefinition<Meter> {
    return new CreditsDefinition(this.name, {
      ...this.properties,
      rollover: true,
    })
  }
}

class CreditsBuilder<Meter extends string> {
  constructor(
    private readonly name: string | undefined,
    private readonly meterExternalId: Meter,
  ) {}

  units(units: number): CreditsDefinition<Meter> {
    return new CreditsDefinition(this.name, {
      meter_external_id: this.meterExternalId,
      units,
      rollover: false,
    })
  }
}

export const credits = (options: BenefitOptions = {}) => ({
  meter: <const Meter extends string>(meter: Meter) =>
    new CreditsBuilder(options.displayName, meter),
})

export type BenefitHelpers<Meter extends string> = {
  readonly flag: typeof flag
  readonly credits: (options?: BenefitOptions) => {
    readonly meter: (meter: Meter) => CreditsBuilder<Meter>
  }
}
