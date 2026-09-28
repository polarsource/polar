import { Console, Effect, Option } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { org } from '@/commands/flags'
import { type ListenEvent, startListening } from '@/services/listen'
import { Organizations } from '@/services/organizations'
import * as ui from '@/utils/ui'

const EVENT_TYPE_WIDTH = 28

const printError = (line: string) =>
  Effect.sync(() => {
    process.stderr.write(`${line}\n`)
  })

const eventLine = (eventType: string, outcome: string, durationMs: number) =>
  `  ${ui.timestamp()}  ${ui.cyan(eventType.padEnd(EVENT_TYPE_WIDTH))}  ${outcome}  ${ui.duration(durationMs)}`

const decodeFailure = (key: string | undefined) =>
  ui.failure(
    'Received an event the CLI could not decode',
    `Event key: ${key ?? 'unknown'}. Run ${ui.command('polar update')} in case the format changed.`,
  )

const banner = (organizationName: string, secret: string, forwardUrl: string) =>
  [
    ui.blank,
    `  ${ui.green('●')} ${ui.bold('Connected')}  ${ui.bold(organizationName)}`,
    ui.keyValue([
      ['Forwarding', forwardUrl],
      [
        'Secret',
        `${secret}  ${ui.dim('use this to verify signatures locally')}`,
      ],
    ]),
    ui.blank,
    ui.step(`Waiting for events... press ${ui.bold('Ctrl+C')} to stop`),
    ui.blank,
  ].join('\n')

export const renderEvent =
  (organizationName: string, forwardUrl: string) => (event: ListenEvent) => {
    switch (event._tag) {
      case 'Connected':
        return Console.log(banner(organizationName, event.secret, forwardUrl))
      case 'Undecodable':
        return printError(decodeFailure(event.key))
      case 'Forwarded':
        return Console.log(
          eventLine(
            event.eventType,
            ui.statusCode(event.status, event.statusText),
            event.durationMs,
          ),
        )
      case 'ForwardFailed':
        return printError(
          eventLine(
            event.eventType,
            ui.red(`failed  ${event.reason}`),
            event.durationMs,
          ),
        )
    }
  }

const url = Argument.String('url').pipe(
  Argument.withDescription(
    'Local URL to forward webhook events to, e.g. http://localhost:3000/api/webhooks',
  ),
)

export const listen = Command.make('listen', { url, org }, ({ url, org }) =>
  Effect.gen(function* () {
    const organizations = yield* Organizations
    const organization = yield* organizations.resolve(
      Option.getOrUndefined(org),
    )
    return yield* startListening({
      organization,
      forwardUrl: url,
      onEvent: renderEvent(organization.name, url),
    })
  }),
).pipe(
  Command.withDescription(
    'Forward webhook events for an organization to a local URL',
  ),
)
