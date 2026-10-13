import { Schema } from 'effect'
import { Builder } from './builder'
import { Metadata, withMetadata, type HasMetadata } from './metadata'
import { Visibility, withVisibility, type HasVisibility } from './visibility'

const benefitFields = {
  external_id: Schema.String.check(Schema.isMinLength(1)),
  description: Schema.String.check(
    Schema.isMinLength(3),
    Schema.isMaxLength(42),
  ),
  metadata: Schema.optionalKey(Metadata),
  visibility: Schema.optionalKey(Visibility),
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
  | ({
      readonly name: string | undefined
      readonly type: 'feature_flag'
    } & HasMetadata &
      HasVisibility)
  | ({
      readonly name: string | undefined
      readonly type: 'meter_credit'
      readonly properties: {
        readonly meter: Meter
        readonly units: number
        readonly rollover: boolean
      }
    } & HasMetadata &
      HasVisibility)

class FlagDefinition extends withMetadata(withVisibility(Builder)) {
  readonly type = 'feature_flag'

  constructor(readonly name: string | undefined) {
    super()
  }
}

export const flag = (name?: string): FlagDefinition => new FlagDefinition(name)

class CreditsDefinition<Meter extends string> extends withMetadata(
  withVisibility(Builder),
) {
  readonly type = 'meter_credit'

  constructor(
    readonly name: string | undefined,
    readonly properties: {
      readonly meter: Meter
      readonly units: number
      readonly rollover: boolean
    },
  ) {
    super()
  }

  rollover(): this {
    return this.with({ properties: { ...this.properties, rollover: true } })
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
