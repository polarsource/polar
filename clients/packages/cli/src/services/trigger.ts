import { Context, Data, Effect, Layer, Schema } from 'effect'
import { HttpClientRequest, HttpClientResponse } from 'effect/unstable/http'
import type {
  ActiveOrganization,
  AuthError,
  PolarEnvironment,
} from '@/schemas/Auth'
import {
  type ApiClient,
  apiUrl,
  authenticatedClient,
  describeApiFailure,
} from '@/services/api'

export class TriggerError extends Data.TaggedError('TriggerError')<{
  message: string
  hint?: string
}> {}

export class NoActiveListener extends Data.TaggedError('NoActiveListener')<{
  organization: ActiveOrganization
}> {}

export class UnknownEvent extends Data.TaggedError('UnknownEvent')<{
  event: string
  suggestion?: string
}> {}

export class PayloadRejected extends Data.TaggedError('PayloadRejected')<{
  detail: unknown
}> {}

const TriggerEventSchema = Schema.Struct({
  type: Schema.String,
  description: Schema.String,
})
export type TriggerEvent = typeof TriggerEventSchema.Type

const TriggerResponseSchema = Schema.Struct({
  webhook_event_id: Schema.String,
  event: Schema.String,
  delivered: Schema.Boolean,
  payload: Schema.Unknown,
})

const ErrorResponseSchema = Schema.Struct({ detail: Schema.Unknown })

export interface TriggerRequest {
  event: string
  overrides: Record<string, unknown>
  seed?: number
  deliver: boolean
}

export interface TriggerResult {
  webhookEventId: string
  event: string
  delivered: boolean
  payload: unknown
}

export type SendError =
  | AuthError
  | TriggerError
  | NoActiveListener
  | UnknownEvent
  | PayloadRejected

export class Trigger extends Context.Service<
  Trigger,
  {
    listEvents: (
      environment: PolarEnvironment,
    ) => Effect.Effect<ReadonlyArray<TriggerEvent>, AuthError | TriggerError>
    send: (
      organization: ActiveOrganization,
      request: TriggerRequest,
    ) => Effect.Effect<TriggerResult, SendError>
  }
>()('Trigger') {}

const normalizeEventName = (name: string) =>
  name.toLowerCase().replace(/[-_]/g, '.')

const editDistance = (a: string, b: string) => {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[b.length]!
}

export const closestEvent = (
  input: string,
  events: ReadonlyArray<string>,
): string | undefined => {
  const wanted = normalizeEventName(input)
  const exact = events.find((event) => normalizeEventName(event) === wanted)
  if (exact) return exact
  const ranked = events
    .map((event) => ({
      event,
      distance: editDistance(wanted, normalizeEventName(event)),
    }))
    .sort((a, b) => a.distance - b.distance)
  const best = ranked[0]
  return best && best.distance <= Math.max(3, Math.floor(wanted.length / 3))
    ? best.event
    : undefined
}

const isUnknownEventError = (detail: unknown) =>
  Array.isArray(detail) &&
  detail.some(
    (error: { loc?: unknown[] }) =>
      Array.isArray(error.loc) && error.loc.join('.') === 'body.event',
  )

const apiFailure = (status: number, environment: PolarEnvironment) => {
  const { message, hint } = describeApiFailure(status, environment)
  return hint
    ? new TriggerError({ message, hint })
    : new TriggerError({ message })
}

const unreachable = (error: { message: string }) =>
  new TriggerError({
    message: 'Could not reach the Polar API',
    hint: error.message,
  })

const unexpectedResponse = () =>
  new TriggerError({ message: 'Unexpected response from the API' })

export const make = Effect.gen(function* () {
  const clients: Record<PolarEnvironment, ApiClient> = {
    sandbox: yield* authenticatedClient('sandbox'),
    production: yield* authenticatedClient('production'),
  }

  const listEvents = (environment: PolarEnvironment) =>
    Effect.gen(function* () {
      const response = yield* clients[environment].execute(
        HttpClientRequest.get(yield* apiUrl(environment, '/cli/events')),
      )
      if (response.status !== 200) {
        return yield* apiFailure(response.status, environment)
      }
      return yield* HttpClientResponse.schemaBodyJson(
        Schema.Array(TriggerEventSchema),
      )(response)
    }).pipe(
      Effect.scoped,
      Effect.catchTags({
        HttpClientError: unreachable,
        SchemaError: unexpectedResponse,
      }),
    )

  const send = (organization: ActiveOrganization, request: TriggerRequest) =>
    Effect.gen(function* () {
      const { environment } = organization
      const httpRequest = yield* HttpClientRequest.post(
        yield* apiUrl(environment, `/cli/trigger/${organization.id}`),
      ).pipe(HttpClientRequest.bodyJson(request))
      const response = yield* clients[environment].execute(httpRequest)

      if (response.status === 409) {
        return yield* new NoActiveListener({ organization })
      }
      if (response.status === 422) {
        const body =
          yield* HttpClientResponse.schemaBodyJson(ErrorResponseSchema)(
            response,
          )
        if (isUnknownEventError(body.detail)) {
          const events = yield* listEvents(environment)
          const suggestion = closestEvent(
            request.event,
            events.map((item) => item.type),
          )
          return yield* new UnknownEvent({
            event: request.event,
            ...(suggestion ? { suggestion } : {}),
          })
        }
        return yield* new PayloadRejected({ detail: body.detail })
      }
      if (response.status !== 200) {
        return yield* apiFailure(response.status, environment)
      }

      const result = yield* HttpClientResponse.schemaBodyJson(
        TriggerResponseSchema,
      )(response)
      return {
        webhookEventId: result.webhook_event_id,
        event: result.event,
        delivered: result.delivered,
        payload: result.payload,
      }
    }).pipe(
      Effect.scoped,
      Effect.catchTags({
        HttpClientError: unreachable,
        HttpBodyError: () =>
          new TriggerError({ message: 'Could not encode the request' }),
        SchemaError: unexpectedResponse,
      }),
    )

  return Trigger.of({ listEvents, send })
})

export const layer = Layer.effect(Trigger, make)
