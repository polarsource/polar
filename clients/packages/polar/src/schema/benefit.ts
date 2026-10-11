import { Schema } from 'effect'
import { Metadata, metadataKey } from './metadata'

const benefitFields = {
  external_id: Schema.String.check(Schema.isMinLength(1)),
  description: Schema.String.check(
    Schema.isMinLength(3),
    Schema.isMaxLength(42),
  ),
  metadata: Schema.optionalKey(Metadata),
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
      readonly [metadataKey]?: Metadata | undefined
    }
  | {
      readonly name: string | undefined
      readonly type: 'meter_credit'
      readonly properties: {
        readonly meter: Meter
        readonly units: number
        readonly rollover: boolean
      }
      readonly [metadataKey]?: Metadata | undefined
    }

class FlagDefinition<Values extends Metadata | undefined = undefined> {
  readonly type = 'feature_flag'
  readonly [metadataKey]: Values

  constructor(
    readonly name: string | undefined,
    metadata: Values,
  ) {
    this[metadataKey] = metadata
  }

  metadata<const Next extends Metadata>(metadata: Next): FlagDefinition<Next> {
    return new FlagDefinition(this.name, { ...metadata })
  }
}

export const flag = (name?: string): FlagDefinition =>
  new FlagDefinition(name, undefined)

class CreditsDefinition<
  Meter extends string,
  Values extends Metadata | undefined = undefined,
> {
  readonly type = 'meter_credit'
  readonly [metadataKey]: Values

  constructor(
    readonly name: string | undefined,
    readonly properties: {
      readonly meter: Meter
      readonly units: number
      readonly rollover: boolean
    },
    metadata: Values,
  ) {
    this[metadataKey] = metadata
  }

  rollover(): CreditsDefinition<Meter, Values> {
    return new CreditsDefinition(
      this.name,
      { ...this.properties, rollover: true },
      this[metadataKey],
    )
  }

  metadata<const Next extends Metadata>(
    metadata: Next,
  ): CreditsDefinition<Meter, Next> {
    return new CreditsDefinition(this.name, this.properties, { ...metadata })
  }
}

class CreditsBuilder<Meter extends string> {
  constructor(
    private readonly name: string | undefined,
    private readonly meterExternalId: Meter,
  ) {}

  units(units: number): CreditsDefinition<Meter> {
    return new CreditsDefinition(
      this.name,
      { meter: this.meterExternalId, units, rollover: false },
      undefined,
    )
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
