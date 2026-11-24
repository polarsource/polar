import {
  type ApiClients,
  type ApiVersion,
  CURRENT_API_VERSION,
} from '@polar-sh/cli-commands'
import { PolarNetworkError, PolarServerError } from '@polar-sh/sdk'
import * as V2026_10 from '@polar-sh/sdk/2026-10'
import * as V2027_01 from '@polar-sh/sdk/2027-01'
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

type CurrentApiVersion = typeof CURRENT_API_VERSION
type PolarSDK = ApiClients[CurrentApiVersion]['client']

interface Sdk<V extends ApiVersion> {
  createPolar: (options: V2026_10.PolarOptions) => ApiClients[V]['client']
  createPolarCore: (options: V2026_10.PolarOptions) => ApiClients[V]['core']
}

const SDKS: { [V in ApiVersion]: Sdk<V> } = {
  '2026-10': V2026_10,
  '2027-01': V2027_01,
}

interface UseOptions<V extends ApiVersion> {
  timeout?: number
  authenticated?: boolean
  organizationId?: string | undefined
  apiVersion?: V | undefined
}

const ApiErrorName = Schema.Struct({ error: Schema.String })

const apiErrorOf = (body: unknown) =>
  Option.getOrUndefined(
    Schema.decodeUnknownOption(
      Schema.Union([ApiErrorName, Schema.fromJsonString(ApiErrorName)]),
    )(body),
  )?.error

const ValidationIssue = Schema.Struct({
  loc: Schema.Array(Schema.Union([Schema.String, Schema.Finite])),
  msg: Schema.String,
})

const ErrorDetail = Schema.Struct({
  detail: Schema.Union([Schema.String, Schema.Array(ValidationIssue)]),
})

const repeatFlagHint = (loc: ReadonlyArray<string | number>, msg: string) => {
  const name = loc.at(-2)
  if (
    typeof loc.at(-1) !== 'number' ||
    typeof name !== 'string' ||
    !msg.includes('valid UUID') ||
    !msg.includes('found `[`')
  ) {
    return ''
  }
  const flag = `--${name.replace(/_/g, '-')}`
  return `. Repeat ${flag} once per ID instead of passing a list, e.g. ${flag} <id> ${flag} <id>`
}

const describeIssues = (issues: ReadonlyArray<typeof ValidationIssue.Type>) =>
  [
    'The request is invalid:',
    ...issues.map(({ loc, msg }) => {
      const field = (loc[0] === 'body' ? loc.slice(1) : loc).join('.')
      const message = `${msg}${repeatFlagHint(loc, msg)}`
      return field ? `${field}: ${message}` : message
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

const REQUEST_TIMEOUT_SECONDS = 5
const MESSAGE_LENGTH = 200
const DEBUG_BODY_LENGTH = 1000

const serverErrorPrefix = (statusCode: number) =>
  `Polar API returned a server error: ${statusCode} - `

const networkErrorPrefix = 'Polar API network error: '

const truncate = (text: string, length: number) =>
  text.length > length ? `${text.slice(0, length - 1)}…` : text

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`)

const emptyBodyPlaceholders = new Set<unknown>(['Server error', 'Client error'])

const responseBody = (error: unknown, statusCode: number) => {
  const prefix = serverErrorPrefix(statusCode)
  const body =
    error instanceof PolarServerError
      ? error.message.startsWith(prefix)
        ? error.message.slice(prefix.length)
        : undefined
      : typeof error === 'object' && error !== null && 'error' in error
        ? error.error
        : undefined
  return emptyBodyPlaceholders.has(body) ? undefined : body
}

const serverMessage = (body: unknown, detail: string | undefined) => {
  if (detail) return detail
  if (typeof body !== 'string') return undefined
  const text = body.trim()
  if (text.startsWith('{') || text.startsWith('[')) return undefined
  const message = text.startsWith('<')
    ? /<title>([^<]*)<\/title>/i.exec(text)?.[1]
    : text
  const collapsed = message?.replace(/\s+/g, ' ').trim()
  return collapsed ? truncate(collapsed, MESSAGE_LENGTH) : undefined
}

type RequestFailure =
  | {
      readonly _tag: 'Status'
      readonly statusCode: number
      readonly apiError: string | undefined
      readonly detail: string | undefined
      readonly message: string | undefined
      readonly body: unknown
    }
  | { readonly _tag: 'Timeout'; readonly cause: string }
  | { readonly _tag: 'Unreachable'; readonly cause: string }
  | { readonly _tag: 'Unexpected'; readonly cause: string }

const requestFailure = (error: unknown): RequestFailure => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  ) {
    const body = responseBody(error, error.statusCode)
    const detail = detailOf(body)
    return {
      _tag: 'Status',
      statusCode: error.statusCode,
      apiError: apiErrorOf(body),
      detail,
      message: serverMessage(body, detail),
      body,
    }
  }
  if (error instanceof PolarNetworkError) {
    const cause = error.message.replace(networkErrorPrefix, '')
    return /timed? ?out/i.test(cause)
      ? { _tag: 'Timeout', cause }
      : { _tag: 'Unreachable', cause }
  }
  return {
    _tag: 'Unexpected',
    cause:
      error instanceof Error
        ? [error.name, error.message].filter(Boolean).join(': ')
        : String(error),
  }
}

const describeFailure = (
  failure: RequestFailure,
  host: string,
  timeout: number,
) => {
  switch (failure._tag) {
    case 'Timeout':
      return `The request to the Polar API at ${host} timed out after ${timeout}s. It may be under heavy load, try again shortly.`
    case 'Unreachable':
      return `Could not connect to the Polar API at ${host}. Check your connection and try again.`
    case 'Unexpected':
      return `The Polar API request failed: ${sentence(failure.cause)}`
    case 'Status': {
      const { statusCode, detail, message } = failure
      if (statusCode < 500 && detail) return detail
      const reported = message ? `: ${sentence(message)}` : '.'
      return statusCode >= 500
        ? `The Polar API returned an error (${statusCode})${reported} It may be having issues, try again shortly.`
        : `The Polar API rejected the request (${statusCode})${reported}`
    }
  }
}

const debugDetails = (failure: RequestFailure) =>
  failure._tag === 'Status'
    ? {
        status: failure.statusCode,
        body: truncate(
          typeof failure.body === 'string'
            ? failure.body
            : (JSON.stringify(failure.body) ?? ''),
          DEBUG_BODY_LENGTH,
        ),
      }
    : { cause: failure.cause }

interface PolarImpl {
  getClient: (
    environment?: PolarEnvironment,
  ) => Effect.Effect<PolarSDK, AuthError>
  use: <A, V extends ApiVersion = CurrentApiVersion>(
    fn: (
      client: ApiClients[V]['client'],
      core: ApiClients[V]['core'],
    ) => Promise<A>,
    environment?: PolarEnvironment,
    options?: UseOptions<V>,
  ) => Effect.Effect<A, AuthError>
}

export const make = Effect.gen(function* () {
  const auth = yield* Auth

  const getClient = (environment: PolarEnvironment = 'sandbox') =>
    Effect.gen(function* () {
      const baseUrl = yield* apiOrigin(environment)
      const { accessToken } = yield* auth.resolve(environment)
      return SDKS[CURRENT_API_VERSION].createPolar({
        baseUrl,
        accessToken: Redacted.value(accessToken),
      })
    })

  const use = <A, V extends ApiVersion = CurrentApiVersion>(
    fn: (
      client: ApiClients[V]['client'],
      core: ApiClients[V]['core'],
    ) => Promise<A>,
    environment: PolarEnvironment = 'sandbox',
    options?: UseOptions<V>,
  ) =>
    Effect.gen(function* () {
      const {
        authenticated = true,
        apiVersion,
        timeout = REQUEST_TIMEOUT_SECONDS,
        ...requestOptions
      } = options ?? {}
      const sdk = SDKS[apiVersion ?? (CURRENT_API_VERSION as V)]
      const baseUrl = yield* apiOrigin(environment)
      const credential = authenticated
        ? yield* auth.resolve(environment)
        : undefined
      const request = (accessToken?: Redacted.Redacted<string>) =>
        Effect.tryPromise({
          try: () => {
            const clientOptions = {
              baseUrl,
              accessToken: accessToken ? Redacted.value(accessToken) : '',
              timeout,
              ...requestOptions,
            }
            return fn(
              sdk.createPolar(clientOptions),
              sdk.createPolarCore(clientOptions),
            )
          },
          catch: requestFailure,
        })

      return yield* request(credential?.accessToken).pipe(
        Effect.catch((failure) =>
          Effect.gen(function* () {
            if (
              credential?.source !== 'keyring' ||
              failure._tag !== 'Status' ||
              failure.statusCode !== 401
            )
              return yield* Effect.fail(failure)

            yield* Effect.logDebug(
              `Polar API rejected the ${environment} session, retrying with a refreshed token`,
            )
            const refreshed = yield* auth.resolve(
              environment,
              credential.accessToken,
            )
            return yield* request(refreshed.accessToken)
          }),
        ),
        Effect.tapError((failure) =>
          failure instanceof AuthError
            ? Effect.void
            : Effect.logDebug('Polar API request failed').pipe(
                Effect.annotateLogs({
                  environment,
                  api: baseUrl,
                  failure: failure._tag,
                  timeout: `${timeout}s`,
                  ...debugDetails(failure),
                }),
              ),
        ),
        Effect.mapError((failure) => {
          if (failure instanceof AuthError) return failure
          const message = describeFailure(
            failure,
            new URL(baseUrl).host,
            timeout,
          )
          if (failure._tag !== 'Status') return new AuthError({ message })
          switch (failure.statusCode) {
            case 401:
              return new AuthError({
                statusCode: failure.statusCode,
                message: `Authentication rejected for ${environment}. Check POLAR_ACCESS_TOKEN or run ${loginCommand(environment)} --new-session.`,
              })
            case 403:
              return new AuthError({
                statusCode: failure.statusCode,
                message:
                  failure.apiError === 'RequestedOrganizationNotAccessible'
                    ? `Organization ${requestOptions.organizationId} is not accessible with this credential. Check --org or run ${orgCommand}.`
                    : 'Access denied. Check the token permissions (organizations:read is required to list organizations).',
              })
            case 404:
              return new AuthError({
                statusCode: failure.statusCode,
                message:
                  failure.apiError === 'InvoiceDoesNotExist'
                    ? `${failure.detail ?? 'No invoice exists for this order.'} Run polar orders generate_invoice <id> to create it, then run polar orders invoice <id> again after a few seconds.`
                    : `${failure.detail ?? 'Not found'} in ${environment}. Check the ID, or run ${orgCommand} to switch if it belongs to another organization.`,
              })
            default:
              return new AuthError({
                statusCode: failure.statusCode,
                message,
              })
          }
        }),
      )
    })

  return Polar.of({ getClient, use })
})

export const layer = Layer.effect(Polar, make)
