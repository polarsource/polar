import { ChildProcess } from 'node:child_process'
import * as http from 'node:http'
import { Effect } from 'effect'
import * as browser from 'open'
import { expect, test, vi } from 'vitest'
import { loginCopy } from '@/utils/callback-page'
import { awaitCallback } from '@/utils/loopback'

vi.mock('node:http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:http')>()
  return { ...actual, createServer: vi.fn(actual.createServer) }
})
vi.mock('open', () => ({ default: vi.fn() }))

const get = (url: URL) =>
  new Promise<number | undefined>((resolve, reject) => {
    http
      .get(url, (response) => {
        response.resume()
        response.on('end', () => resolve(response.statusCode))
      })
      .on('error', reject)
  })

test('ignores callbacks with the wrong state and keeps waiting', async () => {
  const server = http.createServer()
  const nativeListen = server.listen.bind(server)
  vi.spyOn(server, 'listen').mockImplementation((...args: unknown[]) =>
    nativeListen(0, '127.0.0.1', args[2] as () => void),
  )
  vi.spyOn(http, 'createServer').mockReturnValue(server)
  const statuses: Array<number | undefined> = []
  let browserDone: Promise<ChildProcess> | undefined
  vi.spyOn(browser, 'default').mockImplementation(() => {
    browserDone = visit()
    return browserDone
  })
  const visit = async () => {
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('Expected a TCP listener')
    const callback = (params: Record<string, string>) =>
      new URL(
        `http://127.0.0.1:${address.port}/callback?${new URLSearchParams(params)}`,
      )
    statuses.push(await get(callback({ state: 'forged', error: 'denied' })))
    statuses.push(await get(callback({ state: 'expected', code: 'code' })))
    return new ChildProcess()
  }

  const result = await Effect.runPromise(
    awaitCallback({
      path: '/callback',
      state: 'expected',
      target: new URL('https://polar.sh/authorize'),
      parse: (url) => ({
        outcome: 'success',
        value: url.searchParams.get('code')!,
      }),
      copy: loginCopy,
      browserError: 'browser',
      timeoutError: 'timeout',
    }),
  )

  await browserDone
  expect(result).toBe('code')
  expect(statuses).toEqual([400, 200])
})

test('keeps waiting when the browser launcher exits non-zero', async () => {
  const server = new http.Server()
  const nativeListen = server.listen.bind(server)
  vi.spyOn(server, 'listen').mockImplementation((...args: unknown[]) =>
    nativeListen(0, '127.0.0.1', args[2] as () => void),
  )
  vi.spyOn(http, 'createServer').mockReturnValue(server)
  vi.spyOn(browser, 'default').mockImplementation(async () => {
    const child = new ChildProcess()
    setTimeout(() => {
      child.emit('exit', 3)
      const address = server.address()
      if (!address || typeof address === 'string')
        throw new Error('Expected a TCP listener')
      void get(
        new URL(
          `http://127.0.0.1:${address.port}/callback?state=expected&code=code`,
        ),
      )
    })
    return child
  })

  const result = await Effect.runPromise(
    awaitCallback({
      path: '/callback',
      state: 'expected',
      target: new URL('https://polar.sh/authorize'),
      parse: (url) => ({
        outcome: 'success',
        value: url.searchParams.get('code')!,
      }),
      copy: loginCopy,
      browserError: 'browser',
      timeoutError: 'timeout',
    }),
  )

  expect(result).toBe('code')
})
