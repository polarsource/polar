import {
  createPolar,
  createPolarCore,
  type Polar as PolarSDK,
  type PolarCore,
} from '@polar-sh/sdk/2026-10'
import { Context, Effect, Layer, Option, Redacted, Schema } from 'effect'
import {
  AuthError,
  loginCommand,
  orgCommand,
  type PolarEnvironment,
} from '@/schemas/Auth'
import { apiOrigin } from '@/services/api'
import { Auth } from '@/services/auth'

export class Polar extends Context.Service<Polar, PolarImpl>()('Polar') {}

interface UseOptions {
  timeout?: number
  authenticated?: boolean
  organizationId?: string | undefined
}

const OrganizationNotAccessible = Schema.Struct({
  error: Schema.Literal('RequestedOrganizationNotAccessible'),
})

const isOrganizationNotAccessible = (body: unknown) =>
  Option.isSome(
    Schema.decodeUnknownOption(
      Schema.Union([
        OrganizationNotAccessible,
        Schema.fromJsonString(OrganizationNotAccessible),
      ]),
    )(body),
  )

const ValidationIssue = Schema.Struct({
  loc: Schema.Array(Schema.Union([Schema.String, Schema.Number])),
  msg: Schema.String,
})

const ErrorDetail = Schema.Struct({
  detail: Schema.Union([Schema.String, Schema.Array(ValidationIssue)]),
})

const describeIssues = (issues: ReadonlyArray<typeof ValidationIssue.Type>) =>
  [
    'The request is invalid:',
    ...issues.map(({ loc, msg }) => {
      const field = (loc[0] === 'body' ? loc.slice(1) : loc).join('.')
      return field ? `${field}: ${msg}` : msg
    }),
  ].join('\n    ')

const detailOf = (body: unknown) => {
  const detail = Option.getOrUndefined(
    Schema.decodeUnknownOption(
      Schema.Union([ErrorDetail, Schema.fromJsonString(ErrorDetail)]),
    )(body),
  )?.detail
  return typeof detail === 'string' || detail === undefined
    ? detail
    : describeIssues(detail)
}

const describeFailure = (statusCode: number | undefined, detail?: string) => {
  if (statusCode === undefined) {
    return 'Polar API request failed. Check your connection and try again.'
  }
  if (detail) return detail
  return statusCode >= 500
    ? `The Polar API returned an error (${statusCode}). It may be having issues, try again shortly.`
    : `The Polar API rejected the request (${statusCode}).`
}

interface PolarImpl {
  getClient: (
    environment?: PolarEnvironment,
  ) => Effect.Effect<PolarSDK, AuthError>
  use: <A>(
    fn: (client: PolarSDK, core: PolarCore) => Promise<A>,
    environment?: PolarEnvironment,
    options?: UseOptions,
  ) => Effect.Effect<A, AuthError>
}

export const make = Effect.gen(function* () {
  const auth = yield* Auth

  const getClient = (environment: PolarEnvironment = 'sandbox') =>
    Effect.gen(function* () {
      const baseUrl = yield* apiOrigin(environment)
      const { accessToken } = yield* auth.resolve(environment)
      return createPolar({
        environment,
        baseUrl,
        accessToken: Redacted.value(accessToken),
      })
    })

  const use = <A>(
    fn: (client: PolarSDK, core: PolarCore) => Promise<A>,
    environment: PolarEnvironment = 'sandbox',
    options?: UseOptions,
  ) =>
    Effect.gen(function* () {
      const { authenticated = true, ...requestOptions } = options ?? {}
      const baseUrl = yield* apiOrigin(environment)
      const credential = authenticated
        ? yield* auth.resolve(environment)
        : undefined
      const request = (accessToken?: Redacted.Redacted<string>) =>
        Effect.tryPromise({
          try: () => {
            const clientOptions = {
              environment,
              baseUrl,
              accessToken: accessToken ? Redacted.value(accessToken) : '',
              ...requestOptions,
            }
            return fn(
              createPolar(clientOptions),
              createPolarCore(clientOptions),
            )
          },
          catch: (error) => {
            const body =
              typeof error === 'object' && error !== null && 'error' in error
                ? error.error
                : undefined
            return {
              statusCode:
                typeof error === 'object' &&
                error !== null &&
                'statusCode' in error &&
                typeof error.statusCode === 'number'
                  ? error.statusCode
                  : undefined,
              organizationNotAccessible: isOrganizationNotAccessible(body),
              detail: detailOf(body),
            }
          },
        })

      return yield* request(credential?.accessToken).pipe(
        Effect.catch((error) =>
          Effect.gen(function* () {
            if (credential?.source !== 'keyring' || error.statusCode !== 401)
              return yield* Effect.fail(error)

            const refreshed = yield* auth.resolve(
              environment,
              credential.accessToken,
            )
            return yield* request(refreshed.accessToken)
          }),
        ),
        Effect.mapError((error) => {
          if (error instanceof AuthError) return error
          switch (error.statusCode) {
            case 401:
              return new AuthError({
                statusCode: error.statusCode,
                message: `Authentication rejected for ${environment}. Check POLAR_ACCESS_TOKEN or run ${loginCommand(environment)} --new-session.`,
              })
            case 403:
              return new AuthError({
                statusCode: error.statusCode,
                message: error.organizationNotAccessible
                  ? `Organization ${requestOptions.organizationId} is not accessible with this credential. Check --org or run ${orgCommand}.`
                  : 'Access denied. Check the token permissions (organizations:read is required to list organizations).',
              })
            case 404:
              return new AuthError({
                statusCode: error.statusCode,
                message: `${error.detail ?? 'Not found'} in ${environment}. Check the ID, and --org or ${orgCommand} if it belongs to another organization.`,
              })
            default:
              return new AuthError({
                statusCode: error.statusCode,
                message: describeFailure(error.statusCode, error.detail),
              })
          }
        }),
      )
    })

  return Polar.of({ getClient, use })
})

export const layer = Layer.effect(Polar, make)
