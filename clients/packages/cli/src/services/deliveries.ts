import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  Context,
  Duration,
  Effect,
  Layer,
  Option,
  Schedule,
  Schema,
} from 'effect'

export const Delivery = Schema.Struct({
  forwardUrl: Schema.String,
  durationMs: Schema.Number,
  status: Schema.optional(Schema.Number),
  statusText: Schema.optional(Schema.String),
  failure: Schema.optional(Schema.String),
  body: Schema.optional(Schema.String),
})
export type Delivery = typeof Delivery.Type

export class Deliveries extends Context.Service<
  Deliveries,
  {
    record: (eventId: string, delivery: Delivery) => Effect.Effect<void>
    await: (eventId: string) => Effect.Effect<Option.Option<Delivery>>
  }
>()('Deliveries') {}

const eventIdPattern = /^[0-9a-f-]{36}$/i

const decode = Schema.decodeUnknownEffect(Schema.fromJsonString(Delivery))

export const make = (
  directory: string,
  timeout: Duration.Input = '3 seconds',
) => {
  const fileOf = (eventId: string) => join(directory, `${eventId}.json`)
  return Deliveries.of({
    record: (eventId, delivery) =>
      eventIdPattern.test(eventId)
        ? Effect.tryPromise(async () => {
            const file = fileOf(eventId)
            await mkdir(directory, { recursive: true, mode: 0o700 })
            await writeFile(`${file}.tmp`, JSON.stringify(delivery), {
              mode: 0o600,
            })
            await rename(`${file}.tmp`, file)
          }).pipe(Effect.ignore)
        : Effect.void,
    await: (eventId) => {
      if (!eventIdPattern.test(eventId)) return Effect.succeedNone
      const file = fileOf(eventId)
      return Effect.tryPromise(() => readFile(file, 'utf8')).pipe(
        Effect.flatMap(decode),
        Effect.retry(Schedule.spaced('100 millis')),
        Effect.timeoutOption(timeout),
        Effect.tap(() =>
          Effect.tryPromise(() => rm(file, { force: true })).pipe(
            Effect.ignore,
          ),
        ),
        Effect.catch(() => Effect.succeedNone),
      )
    },
  })
}

export const layer = Layer.succeed(
  Deliveries,
  make(join(homedir(), '.polar', 'deliveries')),
)
