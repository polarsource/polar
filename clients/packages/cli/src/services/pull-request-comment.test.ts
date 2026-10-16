import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { Effect, Exit } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { Environment } from '@/services/api'
import { commentOnPullRequest } from '@/services/pull-request-comment'
import * as ui from '@/utils/ui'

const MARKER = '<!-- polar-cli config%20plan%20org-1 -->'

const HEAD = '0123456789abcdef0123456789abcdef01234567'

const EVENT = join(tmpdir(), `polar-cli-pull-request-event-${process.pid}.json`)

await Bun.write(
  EVENT,
  JSON.stringify({ pull_request: { head: { sha: HEAD } } }),
)

type Recorded = {
  method: string
  path: string
  auth: string | null
  body: unknown
}

let stop = () => {}

afterEach(() => stop())

afterAll(() => rmSync(EVENT))

const github = (
  existing: ReadonlyArray<{ id: number; body: string }> = [],
  status = 200,
  deleted = 204,
) => {
  const requests: Recorded[] = []
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      requests.push({
        method: request.method,
        path: new URL(request.url).pathname,
        auth: request.headers.get('authorization'),
        body: ['POST', 'PATCH'].includes(request.method)
          ? await request.json()
          : undefined,
      })
      if (status !== 200) return Response.json({}, { status })
      if (request.method === 'DELETE')
        return new Response(null, { status: deleted })
      return request.method === 'GET'
        ? Response.json(existing.map((item) => ({ ...item, html_url: '' })))
        : Response.json({ id: 9, html_url: 'https://github.com/c/9' })
    },
  })
  stop = () => server.stop(true)
  return { requests, api: `http://localhost:${server.port}` }
}

const post = (env: Record<string, string>, body: string | undefined) =>
  Effect.runPromiseExit(
    commentOnPullRequest('config plan org-1', Effect.succeed(body)).pipe(
      Effect.provideService(Environment, env),
      Effect.provide(FetchHttpClient.layer),
      Effect.provide(BunServices.layer),
    ),
  )

const run = (env: Record<string, string>, body = 'x') => post(env, body)

const actions = (api: string) => ({
  GITHUB_REF: 'refs/pull/12/merge',
  GITHUB_REPOSITORY: 'acme/app',
  GITHUB_TOKEN: 'token',
  GITHUB_API_URL: api,
  GITHUB_SERVER_URL: 'https://github.com',
  GITHUB_RUN_ID: '42',
  GITHUB_EVENT_PATH: EVENT,
})

describe('commentOnPullRequest', () => {
  test('creates a comment on a GitHub Actions pull request', async () => {
    const { requests, api } = github()
    const exit = await run(actions(api), `${ui.green('+')} tool-calls`)
    expect(exit).toEqual(
      Exit.succeed({
        action: 'created',
        number: '12',
        url: 'https://github.com/c/9',
      }),
    )
    expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'GET /repos/acme/app/issues/12/comments',
      'POST /repos/acme/app/issues/12/comments',
    ])
    expect(requests[1]?.auth).toBe('Bearer token')
    expect(requests[1]?.body).toEqual({
      body: [
        MARKER,
        '+ tool-calls',
        '',
        '---',
        `<sub>Commit ${HEAD} · [CI run](https://github.com/acme/app/actions/runs/42) · Updated on every push</sub>`,
      ].join('\n'),
    })
  })

  test('updates its own comment on a Buildkite pull request', async () => {
    const { requests, api } = github([
      { id: 3, body: 'Looks good' },
      { id: 7, body: `${MARKER}\nold plan` },
    ])
    const exit = await run({
      BUILDKITE_PULL_REQUEST: '12',
      BUILDKITE_REPO: 'git@github.com:acme/app.git',
      BUILDKITE_COMMIT: HEAD,
      BUILDKITE_BUILD_URL: 'https://buildkite.com/acme/app/builds/7',
      GITHUB_TOKEN: 'token',
      GITHUB_API_URL: api,
    })
    expect(exit).toMatchObject(Exit.succeed({ action: 'updated' }))
    expect(requests.at(-1)?.method).toBe('PATCH')
    expect(requests.at(-1)?.path).toBe('/repos/acme/app/issues/comments/7')
    expect(requests.at(-1)?.body).toEqual({
      body: expect.stringContaining(
        `<sub>Commit ${HEAD} · [CI run](https://buildkite.com/acme/app/builds/7) · Updated on every push</sub>`,
      ),
    })
  })

  test('leaves the commit out when the event file is unreadable', async () => {
    const { requests, api } = github()
    await run({ ...actions(api), GITHUB_EVENT_PATH: join(tmpdir(), 'missing') })
    expect(requests[1]?.body).toEqual({
      body: expect.stringContaining(
        '<sub>[CI run](https://github.com/acme/app/actions/runs/42) · Updated on every push</sub>',
      ),
    })
  })

  test('removes its comment once the plan has nothing to say', async () => {
    const { requests, api } = github([{ id: 7, body: `${MARKER}\nold plan` }])
    const exit = await post(actions(api), undefined)
    expect(exit).toEqual(Exit.succeed({ action: 'deleted', number: '12' }))
    expect(requests.at(-1)).toMatchObject({
      method: 'DELETE',
      path: '/repos/acme/app/issues/comments/7',
    })
  })

  test('treats a comment that is already gone as removed', async () => {
    const { api } = github([{ id: 7, body: `${MARKER}\nold plan` }], 200, 404)
    const exit = await post(actions(api), undefined)
    expect(exit).toEqual(Exit.succeed({ action: 'deleted', number: '12' }))
  })

  test('posts nothing when the plan has nothing to say', async () => {
    const { requests, api } = github([{ id: 3, body: 'Looks good' }])
    const exit = await post(actions(api), undefined)
    expect(exit).toEqual(Exit.succeed({ action: 'unneeded', number: '12' }))
    expect(requests.map(({ method }) => method)).toEqual(['GET'])
  })

  test('skips outside a pull request', async () => {
    const { requests, api } = github()
    const exit = await run({
      GITHUB_REF: 'refs/heads/main',
      GITHUB_REPOSITORY: 'acme/app',
      BUILDKITE_PULL_REQUEST: 'false',
      GITHUB_TOKEN: 'token',
      GITHUB_API_URL: api,
    })
    expect(exit).toEqual(Exit.succeed({ action: 'skipped' }))
    expect(requests).toEqual([])
  })

  test('fails without GITHUB_TOKEN', async () => {
    const { requests, api } = github()
    const { GITHUB_TOKEN: _, ...env } = actions(api)
    const exit = await run(env)
    expect(exit).toMatchObject({
      cause: { reasons: [{ error: { _tag: 'PullRequestCommentError' } }] },
    })
    expect(requests).toEqual([])
  })

  test('fails with a permissions hint when GitHub refuses', async () => {
    const { api } = github([], 403)
    const exit = await run(actions(api))
    expect(exit).toMatchObject({
      cause: {
        reasons: [
          {
            error: {
              _tag: 'PullRequestCommentError',
              hint: expect.stringContaining('pull-requests: write'),
            },
          },
        ],
      },
    })
  })
})
