import { Context, Effect, Layer, Option, Redacted, Schema } from 'effect'
import {
  HttpClient,
  HttpClientError,
  HttpClientRequest,
} from 'effect/unstable/http'
import { MalformedResponse, VoidError, VoidHttpError } from '../errors'
import * as G from './generated'
import type { EventStorage } from '../storage/storage'
import { withEventStorage } from '../storage/ingest'
import { DEFAULT_EVENT_RETENTION } from '../config/config'
import type { EventChanges } from '../storage/events'
import { coalesce, coalescedReads } from './coalesce'

export type * from './generated'

/** Transport credentials, with an optional checksum for schema-bound clients. */
export class VoidConfig extends Context.Service<
  VoidConfig,
  {
    readonly apiUrl: string
    readonly token: Redacted.Redacted<string>
    readonly checksum?: string
    readonly eventStorage?: readonly EventStorage[]
    readonly eventRetention?: number
    readonly eventChanges?: EventChanges
  }
>()('void/VoidConfig') {}

export type ApiError = VoidHttpError | MalformedResponse | VoidError

/** The generated client, with every failure mapped to one of the SDK's errors. */
export type Client = {
  readonly [K in Exclude<keyof G.VoidApi, 'httpClient'>]: G.VoidApi[K] extends (
    ...args: infer A
  ) => Effect.Effect<infer R, infer _E>
    ? (...args: A) => Effect.Effect<R, ApiError>
    : never
}

export class Api extends Context.Service<Api, Client>()('void/Api') {}

const Envelope = Schema.Struct({
  error: Schema.optionalKey(Schema.String),
  detail: Schema.optionalKey(Schema.Unknown),
})
const decodeEnvelope = Schema.decodeUnknownOption(Envelope)

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const toApiError = (
  error:
    | HttpClientError.HttpClientError
    | Schema.SchemaError
    | { _tag: string },
  apiUrl: string,
): ApiError => {
  if (error instanceof HttpClientError.HttpClientError) {
    const { reason } = error
    if (reason._tag === 'StatusCodeError') {
      const body = parse(reason.description ?? '')
      const envelope = Option.getOrUndefined(decodeEnvelope(body))
      return new VoidHttpError({
        status: reason.response.status,
        path: new URL(reason.request.url).pathname.replace(
          /^\/v1\/void(?=\/|$)/,
          '',
        ),
        code: envelope?.error ?? 'Unknown',
        detail: envelope?.detail ?? body,
      })
    }
    if (reason._tag === 'InvalidUrlError') {
      return new VoidError({
        reason: 'invalid_argument',
        message: reason.description ?? 'void: invalid request URL',
        cause: error,
      })
    }
    return new VoidError({
      reason: 'unreachable',
      message: `void: server unreachable at ${apiUrl}`,
      cause: error,
    })
  }
  if (Schema.isSchemaError(error)) {
    return new MalformedResponse({ path: '', cause: error })
  }
  return new VoidError({
    reason: 'unreachable',
    message: `void: ${error._tag}`,
    cause: error,
  })
}

const requireVoidPath = (
  request: HttpClientRequest.HttpClientRequest,
): Effect.Effect<
  HttpClientRequest.HttpClientRequest,
  HttpClientError.HttpClientError
> => {
  if (
    !URL.canParse(request.url) ||
    !new URL(request.url).pathname.startsWith('/v1/void/')
  ) {
    return Effect.fail(
      new HttpClientError.HttpClientError({
        reason: new HttpClientError.InvalidUrlError({
          request,
          description: 'void: request URL must stay under /v1/void/',
        }),
      }),
    )
  }
  return Effect.succeed(request)
}

/** Like `HttpClient.filterStatusOk`, but keeps the body so `toApiError` can read the envelope. */
const failOnStatus = (client: HttpClient.HttpClient): HttpClient.HttpClient =>
  HttpClient.transformResponse(client, (effect) =>
    Effect.flatMap(effect, (response) =>
      response.status < 400
        ? Effect.succeed(response)
        : Effect.flatMap(response.text, (description) =>
            Effect.fail(
              new HttpClientError.HttpClientError({
                reason: new HttpClientError.StatusCodeError({
                  request: response.request,
                  response,
                  description,
                }),
              }),
            ),
          ),
    ),
  )

type AnyMethod = (
  ...args: ReadonlyArray<never>
) => Effect.Effect<
  unknown,
  HttpClientError.HttpClientError | Schema.SchemaError | { _tag: string }
>

const mapErrors = (
  generated: Omit<G.VoidApi, 'httpClient'>,
  apiUrl: string,
): Client => {
  const out: Record<string, unknown> = {}
  for (const [name, method] of Object.entries(generated)) {
    const call = method as AnyMethod
    const mapped = (...args: ReadonlyArray<never>) =>
      Effect.mapError(call(...args), (error) => toApiError(error, apiUrl))
    out[name] = coalescedReads.has(name) ? coalesce(mapped) : mapped
  }
  return out as Client
}

export const ApiLive = Layer.effect(Api)(
  Effect.gen(function* () {
    const {
      apiUrl,
      token,
      checksum,
      eventStorage,
      eventRetention,
      eventChanges,
    } = yield* VoidConfig
    const httpClient = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest(
        HttpClientRequest.prependUrl(apiUrl.replace(/\/$/, '')),
      ),
      HttpClient.mapRequestEffect(requireVoidPath),
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.bearerToken(token),
          HttpClientRequest.setHeader('Polar-Version', '2026-04'),
          checksum === undefined
            ? (request) => request
            : HttpClientRequest.setHeader('x-void-config', checksum),
        ),
      ),
      failOnStatus,
    )
    const { httpClient: _, ...generated } = G.make(httpClient)
    const client = mapErrors(generated, apiUrl)

    return withEventStorage(
      client,
      eventStorage ?? [],
      eventRetention ?? DEFAULT_EVENT_RETENTION,
      eventChanges,
    )
  }),
)
