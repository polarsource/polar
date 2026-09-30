import { Console, Effect, Option, Stdio } from 'effect'
import { Argument, Command, Flag, Prompt } from 'effect/unstable/cli'
import { org } from '@/commands/flags'
import { formatCatalog } from '@/commands/trigger/catalog'
import { describeRejection, parseOverrides } from '@/commands/trigger/overrides'
import { Deliveries, type Delivery } from '@/services/deliveries'
import { Organizations } from '@/services/organizations'
import { Trigger, TriggerError, type TriggerEvent } from '@/services/trigger'
import { printJson } from '@/utils/json'
import * as ui from '@/utils/ui'

const event = Argument.String('event').pipe(
  Argument.withDescription(
    'Webhook event to send, e.g. order.created. Omit to pick from a list.',
  ),
  Argument.optional,
)

const override = Flag.String('override').pipe(
  Flag.withDescription(
    'Override a payload field, as path=value. Values are sent as text; use null, a JSON object, array or quoted string for other types. Repeatable.',
  ),
  Flag.atLeast(0),
)

const seed = Flag.Int('seed').pipe(
  Flag.withDescription('Seed for generated IDs, for a reproducible payload'),
  Flag.optional,
)

const json = Flag.Boolean('json').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'Print the payload as JSON instead of sending it, or the event list with --list',
  ),
)

const list = Flag.Boolean('list').pipe(
  Flag.withDefault(false),
  Flag.withDescription('List every event you can trigger, with descriptions'),
)

const interactive = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio
  return (yield* stdio.stdinIsTerminal) && (yield* stdio.stdoutIsTerminal)
})

const pickEvent = (events: ReadonlyArray<TriggerEvent>) =>
  Prompt.AutoComplete({
    message: 'Select an event to send',
    filterPlaceholder: 'Type to filter, e.g. order',
    choices: events.map((item) => ({
      value: item.type,
      title: item.type,
      description: item.description,
    })),
  })

const deliveryRows = (
  delivery: Option.Option<Delivery>,
): Array<readonly [string, string]> =>
  Option.match(delivery, {
    onNone: () => [
      [
        'Forwarded by',
        `your ${ui.command('polar listen')} terminal, which shows the response`,
      ],
    ],
    onSome: ({ forwardUrl, status, statusText, failure, durationMs }) => [
      ['Forwarded to', forwardUrl],
      [
        'Response',
        failure
          ? ui.red(`failed  ${failure}`)
          : `${ui.statusCode(status ?? 0, statusText ?? '')}  ${ui.duration(durationMs)}`,
      ],
    ],
  })

const accepted = ({ status, failure }: Delivery) =>
  failure === undefined && status !== undefined && status >= 200 && status < 300

const responseBody = (delivery: Option.Option<Delivery>) =>
  Option.match(delivery, {
    onNone: () => [],
    onSome: ({ body }) =>
      body
        ? [
            ui.blank,
            ...ui
              .printable(body)
              .split('\n')
              .map((line) => `  ${line}`),
          ]
        : [],
  })

const listHint = `Run ${ui.command('polar trigger --list')} to see every event`

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
      const trigger = yield* Trigger

      if (list) {
        const events = yield* trigger.listEvents(organization)
        return yield* json
          ? printJson(events)
          : Console.log(formatCatalog(events))
      }

      const eventType = Option.isSome(event)
        ? event.value
        : yield* pickEvent(yield* trigger.listEvents(organization))

      const result = yield* trigger
        .send(organization, {
          event: eventType,
          overrides,
          ...Option.match(seed, {
            onNone: () => ({}),
            onSome: (seed) => ({ seed }),
          }),
          deliver: !json,
        })
        .pipe(
          Effect.catchTags({
            NoActiveListener: () =>
              new TriggerError({
                message: `Nothing is listening for ${organization.name} in ${environment}`,
                hint: `Run ${ui.command('polar listen <url>')} in another terminal, then try again`,
              }),
            UnknownEvent: ({ event, suggestion }) =>
              new TriggerError({
                message: `Unknown event "${event}"`,
                hint: suggestion
                  ? `Did you mean ${ui.command(`polar trigger ${suggestion}`)}? ${listHint}`
                  : listHint,
              }),
            PayloadRejected: ({ detail }) =>
              new TriggerError({
                message: 'The API rejected the request',
                hint: describeRejection(detail),
              }),
          }),
        )

      if (json) {
        return yield* printJson(result.payload)
      }
      const delivery = yield* (yield* Deliveries).await(result.webhookEventId)
      yield* Console.log(
        [
          ui.blank,
          ui.success(
            `Sent ${ui.cyan(result.event)} to ${ui.bold(organization.name)} ${ui.dim(`(${environment})`)}`,
          ),
          ui.keyValue([
            ['Event ID', ui.dim(result.webhookEventId)],
            ...deliveryRows(delivery),
          ]),
          ...responseBody(delivery),
          ui.blank,
        ].join('\n'),
      )
      if (Option.isSome(delivery) && !accepted(delivery.value)) {
        return yield* new TriggerError({
          message: `Your server did not accept ${result.event}`,
        })
      }
    }),
).pipe(
  Command.withDescription('Send a sample webhook event to your local server'),
  Command.withExamples([
    { command: 'polar trigger', description: 'Pick an event from a list' },
    {
      command: 'polar trigger order.paid',
      description: 'Send a sample order.paid event',
    },
    {
      command:
        'polar trigger order.paid --override data.customer.email=jane@example.com',
      description: 'Change a field in the payload',
    },
    {
      command: 'polar trigger order.paid --seed 7',
      description: 'Generate the same IDs every time',
    },
    {
      command: 'polar trigger order.paid --json',
      description: 'Print the payload instead of sending it',
    },
  ]),
)
