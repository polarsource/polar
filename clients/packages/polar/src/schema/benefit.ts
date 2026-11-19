import { Schema } from 'effect'
import { Builder } from './builder'
import { ExternalId } from './external-id'
import { withDeprecation, type HasDeprecation } from './deprecation'
import { Metadata, withMetadata, type HasMetadata } from './metadata'
import { Visibility, withVisibility, type HasVisibility } from './visibility'

const benefitFields = {
  external_id: ExternalId,
  description: Schema.String.check(
    Schema.isMinLength(3),
    Schema.isMaxLength(42),
  ),
  metadata: Schema.optionalKey(Metadata),
  visibility: Schema.optionalKey(Visibility),
  deprecated: Schema.optionalKey(Schema.Literal(true)),
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
      HasVisibility &
      HasDeprecation)
  | ({
      readonly name: string | undefined
      readonly type: 'meter_credit'
      readonly properties: {
        readonly meter: Meter
        readonly units: number
        readonly rollover: boolean
      }
    } & HasMetadata &
      HasVisibility &
      HasDeprecation)

class FlagDefinition extends withDeprecation(
  withMetadata(withVisibility(Builder)),
) {
  readonly type = 'feature_flag'

  constructor(readonly name: string | undefined) {
    super()
  }
}

/** A feature your app checks a customer has. The name defaults to its key in `benefits`. */
export const flag = (name?: string): FlagDefinition => new FlagDefinition(name)

class CreditsDefinition<Meter extends string> extends withDeprecation(
  withMetadata(withVisibility(Builder)),
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

  /** Carries unused credits over to the next cycle instead of expiring them. */
  rollover(): this {
    return this.with({ properties: { ...this.properties, rollover: true } })
  }
}

class CreditsBuilder<Meter extends string> {
  constructor(
    private readonly name: string | undefined,
    private readonly meterExternalId: Meter,
  ) {}

  /** How many credits customers get each cycle, or once for a one-time purchase. */
  units(units: number): CreditsDefinition<Meter> {
    return new CreditsDefinition(this.name, {
      meter: this.meterExternalId,
      units,
      rollover: false,
    })
  }
}

/** Credits on a meter, used up before any usage is charged, like included tool calls. The name defaults to its key in `benefits`. */
export const credits = (name?: string) => ({
  /** The meter the credits count against. */
  meter: <const Meter extends string>(meter: Meter) =>
    new CreditsBuilder(name, meter),
})

export type BenefitHelpers<Meter extends string> = {
  /** A feature your app checks a customer has. The name defaults to its key in `benefits`. */
  readonly flag: typeof flag
  /** Credits on a meter, used up before any usage is charged, like included tool calls. The name defaults to its key in `benefits`. */
  readonly credits: (name?: string) => {
    /** The meter the credits count against. */
    readonly meter: <const Credited extends Meter>(
      meter: Credited,
    ) => CreditsBuilder<Credited>
  }
}
