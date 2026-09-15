import { isDeepStrictEqual } from 'node:util'
import { Effect, Schema } from 'effect'
import { EventsIngestRequestJson, type EventCreate } from '../api/generated'
import type { Client } from '../api/index'
import { VoidError, VoidHttpError } from '../errors'
import type { EventStorage } from './storage'
import type { EventChanges } from './events'

/** Intercept the shared API so scoped and organization-level ingestion have the same guarantee. */
export function withEventStorage(
  api: Client,
  storage: readonly EventStorage[],
  retention: number,
  changes?: EventChanges,
): Client {
  if (storage.length === 0) return api
  let organizationId: string | undefined
  return {
    ...api,
    eventsIngest: (options) =>
      Effect.gen(function* () {
        // Snapshot caller-owned metadata before awaiting I/O and validate the wire envelope.
        const payload = yield* Effect.try({
          try: () =>
            Schema.decodeUnknownSync(EventsIngestRequestJson)(
              JSON.parse(JSON.stringify(options.payload)),
            ),
          catch: (cause) =>
            new VoidError({
              reason: 'invalid_argument',
              message: 'void: invalid events',
              cause,
            }),
        })
        if (payload.length === 0) return yield* api.eventsIngest(options)
        organizationId ??= (yield* api.organizationsCurrent(undefined)).id
        const owner = organizationId
        const now = new Date().toISOString()
        let events: Required<EventCreate>[] = payload.map((event) => ({
          ...event,
          timestamp: event.timestamp ?? now,
          external_identity_id: event.external_identity_id ?? null,
          metadata: event.metadata ?? {},
        }))
        const pruneBefore = new Date(Date.now() - retention)
        for (const [index, destination] of storage.entries()) {
          const stored = yield* Effect.tryPromise({
            try: async () =>
              destination.persist(owner, events, { pruneBefore }),
            catch: (cause) =>
              new VoidError({
                reason: 'event_storage',
                message: `void: ${destination.type} event storage ${index} failed`,
                cause,
              }),
          })
          if (index > 0 && !isDeepStrictEqual(events, stored)) {
            return yield* Effect.fail(
              new VoidError({
                reason: 'event_storage',
                message: `void: event storage ${index} contains conflicting events`,
              }),
            )
          }
          events = stored
        }
        changes?.notify(false)
        return yield* api.eventsIngest({ ...options, payload: events }).pipe(
          Effect.tapError((error) =>
            Effect.tryPromise({
              try: async () => {
                if (
                  !(error instanceof VoidHttpError) ||
                  ![400, 404, 409, 422].includes(error.status)
                )
                  return
                for (const destination of storage)
                  await destination.reject(owner, events)
                changes?.notify(true)
              },
              catch: (cause) =>
                new VoidError({
                  reason: 'event_storage',
                  message: 'void: could not record rejected events',
                  cause,
                }),
            }),
          ),
        )
      }),
  }
}
