import {
  type ApiClients,
  type ApiVersion,
  CURRENT_API_VERSION,
} from '@polar-sh/cli-commands'
import {
  PolarClientError,
  PolarNetworkError,
  PolarServerError,
} from '@polar-sh/sdk'
import * as V2026_10 from '@polar-sh/sdk/2026-10'
import * as V2027_01 from '@polar-sh/sdk/2027-01'
import {
  Context,
  Data,
  Duration,
  Effect,
  Layer,
  Match,
  Option,
  Redacted,
  Schema,
} from 'effect'
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
// The SDK can't take our AbortSignal, so it gets a later deadline of its own
// to abort the fetch our timeout abandons.
const SDK_ABORT_GRACE_SECONDS = 1
const MESSAGE_LENGTH = 200

const truncate = (text: string, length: number) =>
  text.length > length ? `${text.slice(0, length - 1)}…` : text

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`)

const serverMessage = (body: unknown) => {
  if (typeof body !== 'string') return undefined
  const text = body.trim()
  if (text.startsWith('{') || text.startsWith('[')) return undefined
  const message = text.startsWith('<')
    ? /<title>([^<]*)<\/title>/i.exec(text)?.[1]
    : text
  const collapsed = message?.replace(/\s+/g, ' ').trim()
  return collapsed ? truncate(collapsed, MESSAGE_LENGTH) : undefined
}

class ApiStatusError extends Data.TaggedError('ApiStatusError')<{
  readonly statusCode: number
  readonly body: unknown
}> {
  get detail() {
    return detailOf(this.body)
  }

  get apiError() {
    return apiErrorOf(this.body)
  }

  override get message() {
    const detail = this.detail
    if (this.statusCode < 500 && detail) return detail
    const reported = detail ?? serverMessage(this.body)
    const suffix = reported ? `: ${sentence(reported)}` : '.'
    return this.statusCode >= 500
      ? `The Polar API returned an error (${this.statusCode})${suffix} It may be having issues, try again shortly.`
      : `The Polar API rejected the request (${this.statusCode})${suffix}`
  }
}

class ApiTimeoutError extends Data.TaggedError('ApiTimeoutError')<{
  readonly host: string
  readonly timeout: number
}> {
  override get message() {
    return `The request to the Polar API at ${this.host} timed out after ${this.timeout}s. It may be under heavy load, try again shortly.`
  }
}

class ApiUnreachableError extends Data.TaggedError('ApiUnreachableError')<{
  readonly host: string
  readonly description: string
}> {
  override get message() {
    return `Could not connect to the Polar API at ${this.host}. Check your connection and try again.`
  }
}

class ApiUnexpectedError extends Data.TaggedError('ApiUnexpectedError')<{
  readonly description: string
}> {
  override get message() {
    return `The Polar API request failed: ${sentence(this.description)}`
  }
}

type ApiRequestError =
  | ApiStatusError
  | ApiTimeoutError
  | ApiUnreachableError
  | ApiUnexpectedError

// The SDK substitutes these when the response body is empty.
const emptyBodyPlaceholders = new Set<unknown>(['Server error', 'Client error'])

// PolarServerError keeps the response body only in its message.
const serverErrorBody = (error: PolarServerError) => {
  const prefix = `Polar API returned a server error: ${error.statusCode} - `
  return error.message.startsWith(prefix)
    ? error.message.slice(prefix.length)
    : undefined
}

const statusError = (statusCode: number, body: unknown) =>
  new ApiStatusError({
    statusCode,
    body: emptyBodyPlaceholders.has(body) ? undefined : body,
  })

// Runtimes echo an invalid Authorization header, token included, in the error.
const describeCause = (error: unknown, accessToken: string) => {
  const description =
    error instanceof Error
      ? [error.name, error.message].filter(Boolean).join(': ')
      : String(error)
  return accessToken
    ? description.replaceAll(accessToken, '[redacted]')
    : description
}

const fromSdkError =
  (host: string, accessToken: string) =>
  (error: unknown): ApiRequestError => {
    if (error instanceof PolarServerError)
      return statusError(error.statusCode, serverErrorBody(error))
    if (error instanceof PolarClientError)
      return statusError(error.statusCode, error.error)
    const description = describeCause(error, accessToken)
    if (error instanceof PolarNetworkError)
      return new ApiUnreachableError({ host, description })
    return new ApiUnexpectedError({ description })
  }

const debugAnnotations = (error: ApiRequestError) =>
  Match.valueTags(error, {
    ApiStatusError: ({ statusCode, apiError, message }) => ({
      status: statusCode,
      ...(apiError ? { apiError } : {}),
      message,
    }),
    ApiTimeoutError: () => ({}),
    ApiUnreachableError: ({ description }) => ({ cause: description }),
    ApiUnexpectedError: ({ description }) => ({ cause: description }),
  })

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
      const host = new URL(baseUrl).host
      const credential = authenticated
        ? yield* auth.resolve(environment)
        : undefined

      const request = (accessToken?: Redacted.Redacted<string>) => {
        const token = accessToken ? Redacted.value(accessToken) : ''
        return Effect.tryPromise({
          try: () => {
            const clientOptions = {
              baseUrl,
              accessToken: token,
              timeout: timeout + SDK_ABORT_GRACE_SECONDS,
              ...requestOptions,
            }
            return fn(
              sdk.createPolar(clientOptions),
              sdk.createPolarCore(clientOptions),
            )
          },
          catch: fromSdkError(host, token),
        }).pipe(
          Effect.timeoutOrElse({
            duration: Duration.seconds(timeout),
            orElse: () => Effect.fail(new ApiTimeoutError({ host, timeout })),
          }),
          Effect.tapError((error) =>
            Effect.logDebug('Polar API request failed').pipe(
              Effect.annotateLogs({
                environment,
                api: baseUrl,
                failure: error._tag,
                timeout: `${timeout}s`,
                ...debugAnnotations(error),
              }),
            ),
          ),
        )
      }

      const rejection = (error: ApiStatusError) =>
        new AuthError({
          statusCode: error.statusCode,
          message: Match.value(error.statusCode).pipe(
            Match.when(
              401,
              () =>
                `Authentication rejected for ${environment}. Check POLAR_ACCESS_TOKEN or run ${loginCommand(environment)} --new-session.`,
            ),
            Match.when(403, () =>
              error.apiError === 'RequestedOrganizationNotAccessible'
                ? `Organization ${requestOptions.organizationId} is not accessible with this credential. Check --org or run ${orgCommand}.`
                : 'Access denied. Check the token permissions (organizations:read is required to list organizations).',
            ),
            Match.when(404, () =>
              error.apiError === 'InvoiceDoesNotExist'
                ? `${error.detail ?? 'No invoice exists for this order.'} Run polar orders generate_invoice <id> to create it, then run polar orders invoice <id> again after a few seconds.`
                : `${error.detail ?? 'Not found'} in ${environment}. Check the ID, or run ${orgCommand} to switch if it belongs to another organization.`,
            ),
            Match.orElse(() => error.message),
          ),
        })

      return yield* request(credential?.accessToken).pipe(
        Effect.catchTag('ApiStatusError', (error) =>
          error.statusCode === 401 && credential?.source === 'keyring'
            ? Effect.logDebug(
                `Polar API rejected the ${environment} session, retrying with a refreshed token`,
              ).pipe(
                Effect.andThen(
                  auth.resolve(environment, credential.accessToken),
                ),
                Effect.flatMap((refreshed) => request(refreshed.accessToken)),
              )
            : Effect.fail(error),
        ),
        Effect.catchTag('ApiStatusError', (error) =>
          Effect.fail(rejection(error)),
        ),
        Effect.catchTag(
          ['ApiTimeoutError', 'ApiUnreachableError', 'ApiUnexpectedError'],
          (error) => Effect.fail(new AuthError({ message: error.message })),
        ),
      )
    })

  return Polar.of({ getClient, use })
})

export const layer = Layer.effect(Polar, make)
