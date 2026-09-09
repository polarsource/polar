import { Data, Schema } from 'effect'

export type PolarEnvironment = 'sandbox' | 'production'

export const ActiveOrganization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
})
export type ActiveOrganization = typeof ActiveOrganization.Type

export const Session = Schema.Struct({
  version: Schema.Literal(1),
  accessToken: Schema.RedactedFromValue(Schema.NonEmptyString),
  refreshToken: Schema.optional(
    Schema.RedactedFromValue(Schema.NonEmptyString),
  ),
  expiresAt: Schema.Number,
  scopes: Schema.Array(Schema.String),
})
export type Session = typeof Session.Type

export class AuthError extends Data.TaggedError('AuthError')<{
  message: string
}> {}

export const loginCommand = (environment: PolarEnvironment) =>
  `polar auth login${environment === 'production' ? ' --production' : ''}`

export const orgCommand = (environment: PolarEnvironment) =>
  `polar auth org${environment === 'production' ? ' --production' : ''}`
