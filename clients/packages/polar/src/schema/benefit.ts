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
  }),
  Schema.Struct({
    ...benefitFields,
    type: Schema.Literal('meter_credit'),
    properties: Schema.Struct({
      meter: Schema.String.check(Schema.isMinLength(1)),
      units: Schema.Int.check(
        Schema.isGreaterThan(0),
        Schema.isLessThanOrEqualTo(2147483647),
      ),
      rollover: Schema.Boolean,
    }),
  }),
])

export type BenefitConfig = typeof BenefitConfig.Type

export type BenefitDefinition<Meter extends string = string> =
  | {
      readonly name: string | undefined
      readonly type: 'feature_flag'
    }
  | {
      readonly name: string | undefined
      readonly type: 'meter_credit'
      readonly properties: {
        readonly meter: Meter
        readonly units: number
        readonly rollover: boolean
      }
    }

export const flag = (name?: string): BenefitDefinition<never> => ({
  name,
  type: 'feature_flag',
})

class CreditsDefinition<Meter extends string> {
  readonly type = 'meter_credit'

  constructor(
    readonly name: string | undefined,
    readonly properties: {
      readonly meter: Meter
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
      meter: this.meterExternalId,
      units,
      rollover: false,
    })
  }
}

export const credits = (name?: string) => ({
  meter: <const Meter extends string>(meter: Meter) =>
    new CreditsBuilder(name, meter),
})

export type BenefitHelpers<Meter extends string> = {
  readonly flag: typeof flag
  readonly credits: (name?: string) => {
    readonly meter: (meter: Meter) => CreditsBuilder<Meter>
  }
}
