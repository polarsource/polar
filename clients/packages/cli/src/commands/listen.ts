import { Data, Effect, Exit, Redacted, Schema } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { type ErrorEvent, EventSource, type EventSourceInit } from 'eventsource'
import { environmentPrompt } from '../prompts/environment'
import { organizationLoginPrompt } from '../prompts/organizations'
import {
  ListenAck,
  ListenReconnect,
  ListenWebhookEvent,
} from '../schemas/Events'
import type { Token } from '../schemas/Tokens'
import * as OAuth from '../services/oauth'

export const LISTEN_BASE_URLS = {
  production: 'https://api.polar.sh/v1/cli/listen',
  sandbox: 'https://sandbox-api.polar.sh/v1/cli/listen',
} as const

export class ListenError extends Data.TaggedError('ListenError')<{
  message: string
  code: number
  cause?: unknown
}> {}

const url = Argument.string('url')

/**
 * Minimal subset of the {@link EventSource} interface that {@link startListening}
 * relies on. Keeping it narrow lets tests substitute a fake implementation.
 */
export type ListenEventSource = Pick<EventSource, 'close'> & {
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
}

export type CreateEventSource = (
  url: string,
  init: EventSourceInit,
) => ListenEventSource

export type Forward = typeof fetch

export interface StartListeningOptions {
  /** Fully qualified URL of the CLI listen stream. */
  listenUrl: string
  /** Local URL incoming webhook events are forwarded to. */
  forwardUrl: string
  /** Name of the organization, used for display only. */
  organizationName: string
  /** Access token used to authenticate the stream. */
  accessToken: string
  /** Factory for the event source. Overridable for testing. */
  createEventSource?: CreateEventSource
  /** `fetch` implementation used to forward webhook events. Overridable for testing. */
  forward?: Forward
}

const defaultCreateEventSource: CreateEventSource = (listenUrl, init) =>
  new EventSource(listenUrl, init)

/**
 * Opens the CLI listen stream and forwards incoming webhook events to the local
 * server. When the server emits a `reconnect` event the current connection is
 * closed and a fresh one is established. The returned effect only completes when
 * the stream errors out.
 */
export const startListening = ({
  listenUrl,
  forwardUrl,
  organizationName,
  accessToken,
  createEventSource = defaultCreateEventSource,
  forward = fetch,
}: StartListeningOptions) =>
  Effect.callback<void, ListenError>((resume) => {
    let eventSource: ListenEventSource
    // Reconnections happen transparently behind the scenes; the connection
    // banner should only ever be shown for the very first connection so the
    // output reads as one continuous stream.
    let bannerShown = false

    const connect = () => {
      eventSource = createEventSource(listenUrl, {
        fetch: (input, init) =>
          forward(input, {
            ...init,
            headers: {
              ...init.headers,
              Authorization: `Bearer ${accessToken}`,
            },
          }),
      })

      eventSource.onmessage = (event) => {
        const json = JSON.parse(event.data)
        const ack = Schema.decodeUnknownExit(ListenAck)(json)

        if (Exit.isSuccess(ack)) {
          if (bannerShown) {
            return
          }
          bannerShown = true

          const { secret } = ack.value
          const dim = '\x1b[2m'
          const bold = '\x1b[1m'
          const cyan = '\x1b[36m'
          const reset = '\x1b[0m'

          console.log('')
          console.log(
            `  ${bold}${cyan}Connected${reset}  ${bold}${organizationName}${reset}`,
          )
          console.log(`  ${dim}Secret${reset}     ${secret}`)
          console.log(`  ${dim}Forwarding${reset} ${forwardUrl}`)
          console.log('')
          console.log(`  ${dim}Waiting for events...${reset}`)
          console.log('')

          return
        }

        const reconnect = Schema.decodeUnknownExit(ListenReconnect)(json)

        if (Exit.isSuccess(reconnect)) {
          // The server is about to drop the connection; tear down the current
          // stream and immediately establish a new one.
          eventSource.close()
          connect()
          return
        }

        const webhookEvent = Schema.decodeUnknownExit(ListenWebhookEvent)(json)

        if (Exit.isFailure(webhookEvent)) {
          console.error('>> Failed to decode event')
          return
        }

        const rawPayload = webhookEvent.value.payload.payload

        const eventType = (() => {
          try {
            const parsed = JSON.parse(rawPayload) as { type?: string }
            return parsed.type ?? 'event'
          } catch {
            return 'event'
          }
        })()

        forward(forwardUrl, {
          method: 'POST',
          headers: webhookEvent.value.headers,
          body: rawPayload,
        })
          .then((res) => {
            const cyan = '\x1b[36m'
            const reset = '\x1b[0m'
            console.log(
              `>> '${cyan}${eventType}${reset}' >> ${res.status} ${res.statusText}`,
            )
          })
          .catch((err) => {
            console.error(`>> Failed to forward event: ${err}`)
          })
      }

      eventSource.onerror = (error) => {
        if (error.code === undefined) {
          return
        }

        eventSource.close()
        resume(
          Effect.fail(
            new ListenError({
              code: error.code,
              message:
                error.message ??
                (error.code
                  ? `Event stream error (${error.code})`
                  : 'Event stream error'),
              cause: error,
            }),
          ),
        )
      }
    }

    connect()

    return Effect.sync(() => {
      eventSource.close()
    })
  })

export const listen = Command.make('listen', { url }, ({ url }) =>
  Effect.gen(function* () {
    const environment = yield* environmentPrompt
    const oauth = yield* OAuth.OAuth
    const organization = yield* organizationLoginPrompt(environment)
    const listenUrl = `${LISTEN_BASE_URLS[environment]}/${organization.id}`

    const listenWithToken = (
      token: Token,
      retried = false,
    ): Effect.Effect<void, ListenError | OAuth.OAuthError, never> =>
      startListening({
        listenUrl,
        forwardUrl: url,
        organizationName: organization.name,
        accessToken: Redacted.value(token.token),
      }).pipe(
        Effect.catchTag('ListenError', (error) => {
          if (retried || error.code !== 401) {
            return Effect.fail(error)
          }

          return oauth
            .login(environment)
            .pipe(Effect.flatMap((newToken) => listenWithToken(newToken, true)))
        }),
      )

    const token = yield* oauth.resolveAccessToken(environment)
    yield* listenWithToken(token)
  }),
)
