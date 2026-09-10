import { Console, Effect, Option, Stdio } from 'effect'
import { Argument, Command, Flag, Prompt } from 'effect/unstable/cli'
import { org } from '@/commands/flags'
import { formatCatalog } from '@/commands/trigger/catalog'
import { describeRejection, parseOverrides } from '@/commands/trigger/overrides'
import { Organizations } from '@/services/organizations'
import { Trigger, TriggerError, type TriggerEvent } from '@/services/trigger'
import * as ui from '@/utils/ui'

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

const pickEvent = (events: ReadonlyArray<TriggerEvent>) =>
  Prompt.autoComplete({
    message: 'Select an event to send',
    filterPlaceholder: 'Type to filter, e.g. order',
    choices: events.map((item) => ({
      value: item.type,
      title: item.type,
      description: item.description,
    })),
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
        const events = yield* trigger.listEvents(environment)
        return yield* Console.log(formatCatalog(events))
      }

      const eventType = Option.isSome(event)
        ? event.value
        : yield* pickEvent(yield* trigger.listEvents(environment))

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
        return yield* Console.log(JSON.stringify(result.payload, null, 2))
      }
      yield* Console.log(
        [
          ui.blank,
          ui.success(
            `Sent ${ui.cyan(result.event)} to ${ui.bold(organization.name)} ${ui.dim(`(${environment})`)}`,
          ),
          ui.keyValue([
            ['Event ID', ui.dim(result.webhookEventId)],
            ['Delivered to', `your ${ui.command('polar listen')} terminal`],
          ]),
          ui.blank,
        ].join('\n'),
      )
    }),
).pipe(
  Command.withDescription(
    'Send a sample webhook event to your local server through polar listen. Run with --list to see every event.',
  ),
)
