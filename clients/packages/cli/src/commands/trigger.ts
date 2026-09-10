import { Console, Data, Effect, Option, Schema, Stdio } from 'effect'
import { Argument, Command, Flag, Prompt } from 'effect/unstable/cli'
import { HttpClientRequest, HttpClientResponse } from 'effect/unstable/http'
import { loginCommand, type PolarEnvironment } from '@/schemas/Auth'
import { apiUrl } from '@/services/api'
import { Auth } from '@/services/auth'
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
  error: Schema.String,
  detail: Schema.Unknown,
})

export type Override = readonly [path: string, value: unknown]

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
  const path = input.slice(0, separator)
  const raw = input.slice(separator + 1)
  try {
    return Effect.succeed([path, JSON.parse(raw)] as const)
  } catch {
    return Effect.succeed([path, raw] as const)
  }
}

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

const event = Argument.string('event').pipe(
  Argument.withDescription(
    'Webhook event to send, e.g. order.created. Omit to pick from a list.',
  ),
  Argument.optional,
)

const override = Flag.string('override').pipe(
  Flag.withDescription('Override a payload field, as path=value. Repeatable.'),
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

const fetchEvents = (environment: PolarEnvironment) =>
  Effect.gen(function* () {
    const client = yield* authenticatedStreamClient(environment)
    const response = yield* client.execute(
      HttpClientRequest.get(apiUrl(environment, '/cli/events')),
    )
    return yield* HttpClientResponse.schemaBodyJson(Schema.Array(TriggerEvent))(
      response,
    )
  }).pipe(
    Effect.catchTags({
      HttpClientError: (error) =>
        new TriggerError({
          message: 'Could not load the list of events',
          hint: error.message,
        }),
      SchemaError: () =>
        new TriggerError({ message: 'Unexpected response from the API' }),
    }),
  )

const printEvents = Effect.gen(function* () {
  const auth = yield* Auth
  const [environment] = yield* auth.environments
  if (environment === undefined) {
    return yield* new TriggerError({
      message: 'Not logged in to Polar',
      hint: `Run ${ui.command(loginCommand('sandbox'))} first`,
    })
  }
  const events = yield* fetchEvents(environment)
  const width = Math.max(0, ...events.map((event) => event.type.length))
  let resource = ''
  yield* Console.log(ui.blank)
  for (const event of events) {
    const [eventResource = event.type] = event.type.split('.')
    if (eventResource !== resource) {
      if (resource) yield* Console.log(ui.blank)
      resource = eventResource
      yield* Console.log(`  ${ui.bold(resource)}`)
    }
    yield* Console.log(
      `    ${ui.cyan(event.type.padEnd(width))}  ${ui.dim(event.description)}`,
    )
  }
  yield* Console.log(ui.blank)
  yield* Console.log(
    ui.step(`Send one with ${ui.command('polar trigger <event>')}`),
  )
  yield* Console.log(ui.blank)
})

const selectEvent = (environment: PolarEnvironment) =>
  Effect.gen(function* () {
    const stdio = yield* Stdio.Stdio
    if (!(yield* stdio.stdinIsTerminal) || !(yield* stdio.stdoutIsTerminal)) {
      return yield* new TriggerError({
        message: 'An event name is required when not running interactively',
        hint: `Try ${ui.command('polar trigger order.created')} or ${ui.command('polar trigger --list')}`,
      })
    }
    const events = yield* fetchEvents(environment)
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
      if (list) {
        return yield* printEvents
      }
      const organizations = yield* Organizations
      const organization = yield* organizations.resolve(
        Option.getOrUndefined(org),
      )
      const { environment } = organization
      const eventType = Option.isSome(event)
        ? event.value
        : yield* selectEvent(environment)
      const overrides = Object.fromEntries(
        yield* Effect.forEach(override, parseOverride),
      )

      const client = yield* authenticatedStreamClient(environment)
      const request = yield* HttpClientRequest.post(
        apiUrl(environment, `/cli/trigger/${organization.id}`),
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
        return yield* new TriggerError({
          message: `The API returned an unexpected status (${response.status})`,
        })
      }

      const result =
        yield* HttpClientResponse.schemaBodyJson(TriggerResponse)(response)
      if (json) {
        yield* Console.log(JSON.stringify(result.payload, null, 2))
        return
      }
      yield* Console.log(ui.blank)
      yield* Console.log(
        ui.success(
          `Sent ${ui.cyan(result.event)} to ${ui.bold(organization.name)} ${ui.dim(`(${environment})`)}`,
        ),
      )
      yield* Console.log(
        ui.keyValue([
          ['Event ID', ui.dim(result.webhook_event_id)],
          ['Delivered to', `your ${ui.command('polar listen')} terminal`],
        ]),
      )
      yield* Console.log(ui.blank)
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
