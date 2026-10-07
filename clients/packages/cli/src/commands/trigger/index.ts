import { Effect, Option, Schema, Stdio } from 'effect'
import { Argument, Command, Flag, Prompt } from 'effect/cli'
import { org } from '@/utils/flags'
import { formatCatalog } from '@/utils/trigger/catalog'
import { describeRejection, parseOverrides } from '@/utils/trigger/overrides'
import { Deliveries, Delivery } from '@/services/deliveries'
import { Organizations } from '@/services/organizations'
import {
  TriggerError,
  type TriggerEvent,
  TriggerEventSchema,
} from '@/schemas/Trigger'
import { Trigger } from '@/services/trigger'
import { output } from '@/utils/command'
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

const dryRun = Flag.Boolean('dry-run').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'Print the payload that would be sent, without sending it',
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

const Sent = Schema.Struct({
  kind: Schema.Literal('sent'),
  event: Schema.String,
  webhookEventId: Schema.String,
  organization: Schema.String,
  environment: Schema.String,
  delivery: Schema.optional(Delivery),
})

const Outcome = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('catalog'),
    events: Schema.Array(TriggerEventSchema),
  }),
  Schema.Struct({ kind: Schema.Literal('payload'), payload: Schema.Unknown }),
  Sent,
])
type Outcome = typeof Outcome.Type

const Output = Schema.Union([
  Schema.Array(TriggerEventSchema),
  Schema.Unknown,
  Sent,
])

const sent = (outcome: typeof Sent.Type) => {
  const delivery = Option.fromUndefinedOr(outcome.delivery)
  return [
    ui.blank,
    ui.success(
      `Sent ${ui.cyan(outcome.event)} to ${ui.bold(outcome.organization)} ${ui.dim(`(${outcome.environment})`)}`,
    ),
    ui.keyValue([
      ['Event ID', ui.dim(outcome.webhookEventId)],
      ...deliveryRows(delivery),
    ]),
    ...responseBody(delivery),
    ui.blank,
  ]
}

export const trigger = Command.make('trigger', {
  event,
  org,
  override,
  seed,
  dryRun,
  list,
}).pipe(
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
      command: 'polar trigger order.paid --dry-run',
      description: 'Print the payload instead of sending it',
    },
  ]),
  output({
    result: Output,
    run: ({ event, org, override, seed, dryRun, list }) =>
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
          return { kind: 'catalog', events } satisfies Outcome
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
            deliver: !dryRun,
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

        if (dryRun) {
          return { kind: 'payload', payload: result.payload } satisfies Outcome
        }
        const delivery = yield* (yield* Deliveries).await(result.webhookEventId)
        return {
          kind: 'sent',
          event: result.event,
          webhookEventId: result.webhookEventId,
          organization: organization.name,
          environment,
          delivery: Option.getOrUndefined(delivery),
        } satisfies Outcome
      }),
    render: (outcome) => {
      switch (outcome.kind) {
        case 'catalog':
          return [formatCatalog(outcome.events)]
        case 'payload':
          return [JSON.stringify(outcome.payload, null, 2)]
        case 'sent':
          return sent(outcome)
      }
    },
    json: (outcome) => {
      switch (outcome.kind) {
        case 'catalog':
          return outcome.events
        case 'payload':
          return outcome.payload
        case 'sent':
          return outcome
      }
    },
    failed: (outcome) =>
      outcome.kind === 'sent' && outcome.delivery && !accepted(outcome.delivery)
        ? new TriggerError({
            message: `Your server did not accept ${outcome.event}`,
          })
        : undefined,
  }),
)
