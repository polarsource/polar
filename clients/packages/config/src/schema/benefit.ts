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
  Schema.Struct({
    ...benefitFields,
    type: Schema.Literal('slack_shared_channel'),
    visibility: Schema.optionalKey(Schema.Literal('public')),
    properties: Schema.Struct({
      slack_integration_id: Schema.String.check(Schema.isMinLength(1)),
      channel_name_template: Schema.String.check(
        Schema.isMinLength(1),
        Schema.isMaxLength(80),
      ),
      private: Schema.Boolean,
      welcome_message: Schema.optionalKey(
        Schema.NullOr(Schema.String.check(Schema.isMaxLength(4000))),
      ),
      archive_on_revoke: Schema.Boolean,
      team_invitees: Schema.Array(Schema.String),
    }),
  }),
  Schema.Struct({
    ...benefitFields,
    type: Schema.Literal('custom'),
    properties: Schema.Struct({ note: Schema.NullOr(Schema.String) }),
  }),
])

export type BenefitConfig = typeof BenefitConfig.Type

type SlackChannelProperties = Extract<
  BenefitConfig,
  { type: 'slack_shared_channel' }
>['properties']

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
  | ({
      readonly name: string | undefined
      readonly type: 'slack_shared_channel'
      readonly properties: SlackChannelProperties
    } & HasMetadata &
      HasVisibility &
      HasDeprecation)
  | ({
      readonly name: string | undefined
      readonly type: 'custom'
      readonly properties: { readonly note: string | null }
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

class SlackChannelDefinition extends withDeprecation(withMetadata(Builder)) {
  readonly type = 'slack_shared_channel'

  constructor(
    readonly name: string | undefined,
    readonly properties: SlackChannelProperties,
  ) {
    super()
  }

  private withProperties(patch: Partial<SlackChannelProperties>): this {
    return this.with({ properties: { ...this.properties, ...patch } })
  }

  /** Creates public channels. Channels are private unless you call this. */
  publicChannel(): this {
    return this.withProperties({ private: false })
  }

  /** Posts this message in each channel right after it is created. */
  welcome(message: string): this {
    return this.withProperties({ welcome_message: message })
  }

  /** Leaves the channel open when a customer loses the benefit, instead of archiving it. */
  keepOnRevoke(): this {
    return this.withProperties({ archive_on_revoke: false })
  }

  /** Slack user IDs from your workspace to add to every channel. */
  invite(...users: string[]): this {
    return this.withProperties({ team_invitees: users })
  }
}

/** A Slack Connect channel shared with each customer. The name defaults to its key in `benefits`. */
export const slackChannel = (name?: string) => ({
  /** The ID of the Slack integration connected to your organization. */
  integration: (slackIntegrationId: string) => ({
    /** Template for the channel name, like `acme-{customer_name}`. */
    channel: (template: string) =>
      new SlackChannelDefinition(name, {
        slack_integration_id: slackIntegrationId,
        channel_name_template: template,
        private: true,
        welcome_message: null,
        archive_on_revoke: true,
        team_invitees: [],
      }),
  }),
})

class CustomDefinition extends withDeprecation(
  withMetadata(withVisibility(Builder)),
) {
  readonly type = 'custom'
  readonly properties: { readonly note: string | null } = { note: null }

  constructor(readonly name: string | undefined) {
    super()
  }

  /** A private note shown to customers who have the benefit, like how to reach priority support. */
  note(note: string): this {
    return this.with({ properties: { note } })
  }
}

/** Anything that doesn't fit the other benefits, like priority support. The name defaults to its key in `benefits`. */
export const custom = (name?: string): CustomDefinition =>
  new CustomDefinition(name)

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
  /** A Slack Connect channel shared with each customer. The name defaults to its key in `benefits`. */
  readonly slackChannel: typeof slackChannel
  /** Anything that doesn't fit the other benefits, like priority support. The name defaults to its key in `benefits`. */
  readonly custom: typeof custom
}
