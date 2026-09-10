import { Console, Effect, Option } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { org } from '@/commands/flags'
import { loginCommand } from '@/schemas/Auth'
import { apiUrl } from '@/services/api'
import {
  type FailedForward,
  type ForwardedEvent,
  type ListenConnection,
  ListenError,
  type ListenReporter,
  startListening,
} from '@/services/listen'
import { Organizations } from '@/services/organizations'
import * as ui from '@/utils/ui'

const EVENT_TYPE_WIDTH = 28

const printError = (line: string) =>
  Effect.sync(() => {
    process.stderr.write(`${line}\n`)
  })

const describeForwardFailure = (error: unknown) => {
  const cause =
    error instanceof Error && error.cause instanceof Error ? error.cause : error
  const message = cause instanceof Error ? cause.message : String(cause)
  if (/ECONNREFUSED/i.test(message)) {
    return 'connection refused, is your server running?'
  }
  return message
}

const eventLine = (eventType: string, outcome: string, durationMs: number) =>
  `  ${ui.timestamp()}  ${ui.cyan(eventType.padEnd(EVENT_TYPE_WIDTH))}  ${outcome}  ${ui.duration(durationMs)}`

const banner = ({ organizationName, secret, forwardUrl }: ListenConnection) =>
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

export const reporter: ListenReporter = {
  connected: (connection) => Console.log(banner(connection)),
  forwarded: ({ type, status, statusText, durationMs }: ForwardedEvent) =>
    Console.log(eventLine(type, ui.statusCode(status, statusText), durationMs)),
  forwardFailed: ({ type, error, durationMs }: FailedForward) =>
    printError(
      eventLine(
        type,
        ui.red(`failed  ${describeForwardFailure(error)}`),
        durationMs,
      ),
    ),
  undecodable: (key) =>
    printError(
      ui.failure(
        'Received an event the CLI could not decode',
        `Event key: ${key ?? 'unknown'}. Run ${ui.command('polar update')} in case the format changed.`,
      ),
    ),
}

const url = Argument.string('url').pipe(
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
    const { environment } = organization
    const listenUrl = yield* apiUrl(
      environment,
      `/cli/listen/${organization.id}`,
    )
    return yield* startListening({
      listenUrl,
      forwardUrl: url,
      organizationName: organization.name,
      environment,
      report: reporter,
    }).pipe(
      Effect.mapError((error) =>
        error.code === 401
          ? new ListenError({
              code: 401,
              message: `Authentication rejected for ${environment}. Check POLAR_ACCESS_TOKEN or run ${loginCommand(environment)} --new-session.`,
            })
          : error,
      ),
    )
  }),
).pipe(
  Command.withDescription(
    'Forward webhook events for an organization to a local URL',
  ),
)
