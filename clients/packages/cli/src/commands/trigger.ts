import { Console, Data, Effect, Option, Schema, Stdio } from 'effect'
import { Argument, Command, Flag, Prompt } from 'effect/unstable/cli'
import { HttpClientRequest, HttpClientResponse } from 'effect/unstable/http'
import type { PolarEnvironment } from '@/schemas/Auth'
import { apiUrl, describeApiFailure } from '@/services/api'
import { Organizations } from '@/services/organizations'
import * as ui from '@/utils/ui'
import { org } from '@/commands/flags'
import { authenticatedStreamClient } from '@/commands/listen'

export class TriggerError extends Data.TaggedError('TriggerError')<{
  message: string
  hint?: string
}> {}

const TriggerEvent = Schema.Struct({
  type: Schema.String,
  description: Schema.String,
})

const TriggerResponse = Schema.Struct({
  webhook_event_id: Schema.String,
  event: Schema.String,
  delivered: Schema.Boolean,
  payload: Schema.Unknown,
})

const ErrorResponse = Schema.Struct({
  detail: Schema.Unknown,
})

type Override = readonly [path: string, value: unknown]

const parseValue = (raw: string): unknown => {
  if (raw === 'null') return null
  if (!/^[[{"]/.test(raw)) return raw
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export const parseOverride = (
  input: string,
): Effect.Effect<Override, TriggerError> => {
  const separator = input.indexOf('=')
  if (separator <= 0) {
    return Effect.fail(
      new TriggerError({
        message: `Invalid override "${input}"`,
        hint: 'Use the form path=value, e.g. --override data.customer.email=jane@example.com',
      }),
    )
  }
  return Effect.succeed([
    input.slice(0, separator),
    parseValue(input.slice(separator + 1)),
  ] as const)
}

export const parseOverrides = (inputs: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const entries = yield* Effect.forEach(inputs, parseOverride)
    const seen = new Set<string>()
    for (const [path] of entries) {
      if (seen.has(path)) {
        return yield* new TriggerError({
          message: `Override "${path}" was given more than once`,
        })
      }
      seen.add(path)
    }
    return Object.fromEntries(entries)
  })

export const describeValidationDetail = (detail: unknown) => {
  if (!Array.isArray(detail)) return String(detail)
  return detail
    .map((error: { loc?: unknown[]; msg?: string }) => {
      const location = (error.loc ?? [])
        .filter((segment) => segment !== 'body' && segment !== 'overrides')
        .join('.')
      return location ? `${location}: ${error.msg}` : String(error.msg)
    })
    .join('\n    ')
}

type ApiClient = Effect.Success<ReturnType<typeof authenticatedStreamClient>>

const apiFailure = (status: number, environment: PolarEnvironment) => {
  const { message, hint } = describeApiFailure(status, environment)
  return hint
    ? new TriggerError({ message, hint })
    : new TriggerError({ message })
}

const event = Argument.string('event').pipe(
  Argument.withDescription(
    'Webhook event to send, e.g. order.created. Omit to pick from a list.',
  ),
  Argument.optional,
)

const override = Flag.string('override').pipe(
  Flag.withDescription(
    'Override a payload field, as path=value. Values are sent as text; use null, a JSON object, array or quoted string for other types. Repeatable.',
  ),
  Flag.atLeast(0),
)

const seed = Flag.integer('seed').pipe(
  Flag.withDescription('Seed for generated IDs, for a reproducible payload'),
  Flag.optional,
)

const json = Flag.boolean('json').pipe(
  Flag.withDefault(false),
  Flag.withDescription('Print the payload as JSON instead of sending it'),
)

const list = Flag.boolean('list').pipe(
  Flag.withDefault(false),
  Flag.withDescription('List every event you can trigger, with descriptions'),
)

const interactive = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio
  return (yield* stdio.stdinIsTerminal) && (yield* stdio.stdoutIsTerminal)
})

const fetchEvents = (client: ApiClient, environment: PolarEnvironment) =>
  Effect.gen(function* () {
    const response = yield* client.execute(
      HttpClientRequest.get(yield* apiUrl(environment, '/cli/events')),
    )
    if (response.status !== 200) {
      return yield* apiFailure(response.status, environment)
    }
    return yield* HttpClientResponse.schemaBodyJson(Schema.Array(TriggerEvent))(
      response,
    )
  })

const printEvents = (client: ApiClient, environment: PolarEnvironment) =>
  Effect.gen(function* () {
    const events = yield* fetchEvents(client, environment)
    const width = Math.max(0, ...events.map((event) => event.type.length))
    const lines: string[] = [ui.blank]
    let resource = ''
    for (const event of events) {
      const [eventResource = event.type] = event.type.split('.')
      if (eventResource !== resource) {
        if (resource) lines.push(ui.blank)
        resource = eventResource
        lines.push(`  ${ui.bold(resource)}`)
      }
      lines.push(
        `    ${ui.cyan(event.type.padEnd(width))}  ${ui.dim(event.description)}`,
      )
    }
    lines.push(
      ui.blank,
      ui.step(`Send one with ${ui.command('polar trigger <event>')}`),
      ui.blank,
    )
    yield* Console.log(lines.join('\n'))
  })

const selectEvent = (client: ApiClient, environment: PolarEnvironment) =>
  Effect.gen(function* () {
    const events = yield* fetchEvents(client, environment)
    return yield* Prompt.autoComplete({
      message: 'Select an event to send',
      filterPlaceholder: 'Type to filter, e.g. order',
      choices: events.map((item) => ({
        value: item.type,
        title: item.type,
        description: item.description,
      })),
    })
  })

export const trigger = Command.make(
  'trigger',
  { event, org, override, seed, json, list },
  ({ event, org, override, seed, json, list }) =>
    Effect.gen(function* () {
      const overrides = yield* parseOverrides(override)
      if (!list && Option.isNone(event) && !(yield* interactive)) {
        return yield* new TriggerError({
          message: 'An event name is required when not running interactively',
          hint: `Try ${ui.command('polar trigger order.created')} or ${ui.command('polar trigger --list')}`,
        })
      }

      const organizations = yield* Organizations
      const organization = yield* organizations.resolve(
        Option.getOrUndefined(org),
      )
      const { environment } = organization
      const client = yield* authenticatedStreamClient(environment)

      if (list) {
        return yield* printEvents(client, environment)
      }

      const eventType = Option.isSome(event)
        ? event.value
        : yield* selectEvent(client, environment)
      const request = yield* HttpClientRequest.post(
        yield* apiUrl(environment, `/cli/trigger/${organization.id}`),
      ).pipe(
        HttpClientRequest.bodyJson({
          event: eventType,
          overrides,
          seed: Option.getOrUndefined(seed),
          deliver: !json,
        }),
      )
      const response = yield* client.execute(request)

      if (response.status === 409) {
        return yield* new TriggerError({
          message: `Nothing is listening for ${organization.name} in ${environment}`,
          hint: `Run ${ui.command('polar listen <url>')} in another terminal, then try again`,
        })
      }
      if (response.status === 422) {
        const body =
          yield* HttpClientResponse.schemaBodyJson(ErrorResponse)(response)
        return yield* new TriggerError({
          message: 'The API rejected the request',
          hint: describeValidationDetail(body.detail),
        })
      }
      if (response.status !== 200) {
        return yield* apiFailure(response.status, environment)
      }

      const result =
        yield* HttpClientResponse.schemaBodyJson(TriggerResponse)(response)
      if (json) {
        yield* Console.log(JSON.stringify(result.payload, null, 2))
        return
      }
      yield* Console.log(
        [
          ui.blank,
          ui.success(
            `Sent ${ui.cyan(result.event)} to ${ui.bold(organization.name)} ${ui.dim(`(${environment})`)}`,
          ),
          ui.keyValue([
            ['Event ID', ui.dim(result.webhook_event_id)],
            ['Delivered to', `your ${ui.command('polar listen')} terminal`],
          ]),
          ui.blank,
        ].join('\n'),
      )
    }).pipe(
      Effect.scoped,
      Effect.catchTags({
        HttpClientError: (error) =>
          new TriggerError({
            message: 'Could not reach the Polar API',
            hint: error.message,
          }),
        HttpBodyError: () =>
          new TriggerError({ message: 'Could not encode the request' }),
        SchemaError: () =>
          new TriggerError({ message: 'Unexpected response from the API' }),
      }),
    ),
).pipe(
  Command.withDescription(
    'Send a sample webhook event to your local server through polar listen. Run with --list to see every event.',
  ),
)
