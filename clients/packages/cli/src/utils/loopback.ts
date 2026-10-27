import { createServer } from 'node:http'
import { Effect } from 'effect'
import open from 'open'
import { AuthError } from '@/schemas/Auth'
import {
  callbackPage,
  type CallbackCopy,
  type CallbackOutcome,
} from '@/utils/callback-page'

export const LOOPBACK_ORIGIN = 'http://127.0.0.1:3333'

export type CallbackResult<A> =
  | { outcome: 'success'; value: A }
  | { outcome: Exclude<CallbackOutcome, 'success'>; message: string }

export const validateResult = <A>(result: CallbackResult<A>) =>
  result.outcome === 'success'
    ? Effect.succeed(result.value)
    : Effect.fail(new AuthError({ message: result.message }))

interface CallbackOptions<A> {
  path: string
  state: string
  target: URL
  parse: (url: URL) => CallbackResult<A>
  copy: CallbackCopy
  browserError: string
  timeoutError: string
}

export const awaitCallback = <A>({
  path,
  state,
  target,
  parse,
  copy,
  browserError,
  timeoutError,
}: CallbackOptions<A>) => {
  const server = createServer()
  return Effect.callback<A, AuthError>((resume) => {
    let completed = false
    const finish = (result: Effect.Effect<A, AuthError>) => {
      if (!completed) {
        completed = true
        resume(result)
      }
    }
    const fail = (message: string) =>
      finish(Effect.fail(new AuthError({ message })))
    server.on('request', (request, response) => {
      const url = new URL(request.url ?? '/', LOOPBACK_ORIGIN)
      if (url.pathname !== path || request.method !== 'GET') {
        response.writeHead(404).end()
        return
      }
      if (url.searchParams.get('state') !== state) {
        response
          .writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          .end(callbackPage('invalid', copy))
        return
      }
      const result = parse(url)
      response
        .writeHead(result.outcome === 'invalid' ? 400 : 200, {
          'Content-Type': 'text/html; charset=utf-8',
        })
        .end(callbackPage(result.outcome, copy))
      finish(validateResult(result))
    })
    server.on('error', () =>
      fail(
        'Cannot start the callback server on 127.0.0.1:3333. Check whether the port is occupied.',
      ),
    )
    server.listen(3333, '127.0.0.1', () => {
      void open(target.toString())
        .then((child) => {
          child.on('error', () => fail(browserError))
        })
        .catch(() => fail(browserError))
    })
  }).pipe(
    Effect.ensuring(
      Effect.sync(() => {
        server.close()
        server.closeAllConnections()
      }),
    ),
    Effect.timeout('5 minutes'),
    Effect.mapError((error) =>
      error instanceof AuthError
        ? error
        : new AuthError({ message: timeoutError }),
    ),
  )
}
