import { connect } from 'node:net'
import { Effect, Option } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'
import { type Emit, streaming } from '@/utils/command'
import { org } from '@/utils/flags'
import { withTerminalTitle } from '@/utils/terminal-title'
import {
  type ListenEvent,
  ListenError,
  startListening,
} from '@/services/listen'
import { Organizations } from '@/services/organizations'
import * as ui from '@/utils/ui'
import { redactUrl } from '@/utils/url'

const EVENT_TYPE_WIDTH = 28

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

export const renderEvent = (
  emit: Emit,
  organizationName: string,
  forwardUrl: string,
) => {
  const shownUrl = redactUrl(forwardUrl)
  return (event: ListenEvent) => {
    switch (event._tag) {
      case 'Connected':
        return emit.out(banner(organizationName, event.secret, shownUrl), {
          ...event,
          organization: organizationName,
          forwardUrl: shownUrl,
        })
      case 'Undecodable':
        return emit.err(decodeFailure(event.key), event)
      case 'Forwarded':
        return emit.out(
          eventLine(
            event.eventType,
            ui.statusCode(event.status, event.statusText),
            event.durationMs,
          ),
          event,
        )
      case 'ForwardFailed':
        return emit.err(
          eventLine(
            event.eventType,
            ui.red(`failed  ${event.reason}`),
            event.durationMs,
          ),
          event,
        )
    }
  }
}

export const forwardTarget = (input: string): URL | undefined => {
  const value = input.trim()
  const expanded = /^\d+(\/|$)/.test(value)
    ? `http://localhost:${value}`
    : value.startsWith(':')
      ? `http://localhost${value}`
      : /^[a-z][a-z\d+.-]*:\/\//i.test(value)
        ? value
        : `http://${value}`
  try {
    const url = new URL(expanded)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url
      : undefined
  } catch {
    return undefined
  }
}

export type TargetStatus = 'answering' | 'refused' | 'unknownHost' | 'unknown'

const statusOfError = (code: string | undefined): TargetStatus =>
  code === 'ECONNREFUSED'
    ? 'refused'
    : code === 'ENOTFOUND'
      ? 'unknownHost'
      : 'unknown'

export const probeTarget = (url: URL) =>
  Effect.callback<TargetStatus>((resume) => {
    let settled = false
    const socket = connect({
      host: url.hostname.replace(/^\[|\]$/g, ''),
      port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
    })
    const settle = (status: TargetStatus) => {
      socket.destroy()
      if (settled) return
      settled = true
      resume(Effect.succeed(status))
    }
    socket.setTimeout(1000)
    socket.once('connect', () => settle('answering'))
    socket.once('timeout', () => settle('unknown'))
    socket.once('error', (error: NodeJS.ErrnoException) =>
      settle(statusOfError(error.code)),
    )
    return Effect.sync(() => socket.destroy())
  })

const url = Argument.String('url').pipe(
  Argument.withDescription(
    'Where to forward webhook events: a port like 3000, or a URL like http://localhost:3000/api/webhooks',
  ),
  Argument.optional,
)

const printSecret = Flag.Boolean('print-secret').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'Print the secret that signs forwarded events, then exit',
  ),
)

const printOrganizationSecret = (emit: Emit, id: string | undefined) =>
  Effect.gen(function* () {
    const organization = yield* (yield* Organizations).resolve(id)
    const secret = organization.id.replaceAll('-', '')
    yield* emit.out(secret, { secret })
  })

const listenCommand = (emit: Emit, url: string, org: string | undefined) =>
  Effect.gen(function* () {
    const target = forwardTarget(url)
    if (!target) {
      return yield* new ListenError({
        code: 0,
        message: `"${url}" is not a port or an http(s) URL. Try \`polar listen 3000\` or \`polar listen http://localhost:3000/api/webhooks\`.`,
      })
    }
    const status = yield* probeTarget(target)
    if (status === 'unknownHost') {
      return yield* new ListenError({
        code: 0,
        message: `Can't find a host named "${target.hostname}". To forward to a server on this machine, pass its port, e.g. \`polar listen 3000\`.`,
      })
    }
    const organization = yield* (yield* Organizations).resolve(org)
    if (status === 'refused') {
      yield* emit.err(
        [
          ui.blank,
          ui.warning(`Nothing is running on ${target.host} yet`),
          ui.step(
            'Start your server, events that arrive before then will fail',
          ),
        ].join('\n'),
        { _tag: 'TargetDown', host: target.host },
      )
    }
    return yield* withTerminalTitle(
      `polar listen · ${organization.name}`,
      startListening({
        organization,
        forwardUrl: target.href,
        onEvent: renderEvent(emit, organization.name, target.href),
      }),
    )
  })

export const listen = Command.make('listen', { url, org, printSecret }).pipe(
  Command.withDescription(
    'Forward webhook events for an organization to a local URL',
  ),
  Command.withExamples([
    {
      command: 'polar listen 3000',
      description: 'Forward events to http://localhost:3000',
    },
    {
      command: 'polar listen 3000/api/webhooks',
      description: 'Forward events to a route on your local server',
    },
    {
      command: 'polar listen http://localhost:3000/api/webhooks --org <id>',
      description: 'Forward events for a specific organization',
    },
    {
      command: 'polar listen --print-secret',
      description:
        'Print the signing secret, e.g. for POLAR_WEBHOOK_SECRET in .env',
    },
  ]),
  streaming(({ url, org, printSecret }, emit) =>
    Effect.gen(function* () {
      const organizationId = Option.getOrUndefined(org)
      if (printSecret)
        return yield* printOrganizationSecret(emit, organizationId)
      if (Option.isNone(url)) {
        return yield* new ListenError({
          code: 0,
          message:
            'Pass a port or URL to forward events to, e.g. `polar listen 3000`.',
        })
      }
      return yield* listenCommand(emit, url.value, organizationId)
    }),
  ),
)
