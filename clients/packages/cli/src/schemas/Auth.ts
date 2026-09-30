import { Data, Schema } from 'effect'

export const environments = ['sandbox', 'production'] as const
export const PolarEnvironment = Schema.Literals(environments)
export type PolarEnvironment = typeof PolarEnvironment.Type

export const ActiveOrganization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  environment: PolarEnvironment,
})
export type ActiveOrganization = typeof ActiveOrganization.Type

export const OrganizationSelection = Schema.Struct({
  id: Schema.String,
  environment: PolarEnvironment,
})
export type OrganizationSelection = typeof OrganizationSelection.Type

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
  statusCode?: number | undefined
}> {}

export const loginCommand = (environment: PolarEnvironment) =>
  `polar auth login --${environment}`

export const orgCommand = 'polar auth org'
