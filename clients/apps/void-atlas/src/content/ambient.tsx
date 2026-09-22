import type { Lesson } from '@/lesson/types'
import { AmbientSpan, type Lane } from '@/scenes/AmbientSpan'
import { IDENTITY_HEADER } from '@void/sdk'
import { code } from './code'

const HEAD = `import { createVoid } from '@void/sdk'
import { config, page } from './void'

const client = createVoid(config, { apiUrl, token })
`

const RUN = `${HEAD}
await client.as('alice').run(async () => {
  client.current().id // 'alice'
  await crawl(url) // records crawl.page as alice
})
`

const TAGS = `${HEAD}
await client.as('alice').run(
  async () => {
    client.ambient() // { id: 'alice', tags: { feature: 'chat' } }
    await crawl(url) // captured calls carry feature: chat
  },
  { feature: 'chat' },
)
`

const NESTED = `${HEAD}
await client.as('alice').run(async () => {
  await client.as('nightly').run(async () => {
    client.current().id // 'nightly'
  })
  client.current().id // 'alice' again
})

await Promise.all([
  client.as('alice').run(() => crawl(a)), // sees alice
  client.as('bob').run(() => crawl(b)), // sees bob, at the same time
])
`

const ENSURE = `${HEAD}
await client.as('alice').run(async () => {
  const nightly = await client.ensure('nightly') // parent: 'alice', from scope
  await nightly.events.page.record({ bytes, status: 'ok' })
})

await client.ensure('orphan') // throws VoidError, reason 'no_scope'
`

const MIDDLEWARE = `import express from 'express'
import { client } from './client'

const app = express()

app.use(
  client.middleware((req) => ({
    identity: req.header('x-user')!,
    parent: 'acme',
    tags: { route: req.path },
  })),
)

app.post('/crawl', async (req, res) => {
  const actor = client.current() // the request's user, ensured under acme
  await actor.events.page.record({ bytes: req.body.bytes, status: 'ok' })
  res.sendStatus(202)
})
`

const HEADERS = `// api process
const actor = client.current()
await fetch(workerUrl, {
  method: 'POST',
  headers: { ...actor.headers(), 'content-type': 'application/json' },
  body: JSON.stringify(job),
})

// worker process, another client of the same config
export const POST = async (request: Request) => {
  const actor = client.from(request.headers) // reads ${IDENTITY_HEADER}
  await actor.run(() => crawl(job))
}
`

const OUTSIDE = `${HEAD}
client.ambient() // undefined
client.current() // throws VoidError, reason 'no_scope'

const other = createVoid(config, { apiUrl, token })
await client.as('alice').run(() => {
  other.ambient() // undefined: context belongs to the client that opened it
})
`

const lane = (
  id: string,
  label: string,
  spans: Lane['spans'],
  calls: Lane['calls'],
): Lane => ({
  id,
  label,
  spans,
  calls,
})

const process = (spans: Lane['spans'], calls: Lane['calls']) => [
  lane('process', 'one process', spans, calls),
]

export const ambientLesson: Lesson = {
  slug: 'ambient',
  title: 'Ambient identity',
  summary: 'Who is recording, without passing the identity around.',
  file: 'ambient.ts',
  steps: [
    {
      id: 'run',
      prose: (
        <>
          <p>
            You rarely want to thread an identity through every function.{' '}
            {code('run')} opens a span: while the callback runs, that identity
            is the ambient actor, and {code('client.current()')} returns it from
            anywhere inside.
          </p>
          <p>
            Deep in {code('crawl')}, code that never saw alice can still record
            as her.
          </p>
        </>
      ),
      code: RUN,
      focus: [6, 7, 8, 9],
      scene: (
        <AmbientSpan
          lanes={process(
            [{ id: 'alice', identity: 'alice', start: 8, end: 78 }],
            [
              { at: 22, label: 'current()', lands: 'alice' },
              { at: 58, label: 'record', lands: 'alice' },
            ],
          )}
        />
      ),
    },
    {
      id: 'tags',
      prose: (
        <>
          <p>
            Tags ride along. Whatever is captured inside the span, such as the
            LLM plugin&apos;s completions, carries them as metadata, so spend
            can be explained by feature or route later.
          </p>
          <p>
            {code('ambient()')} reads both without throwing; it is undefined
            outside any span.
          </p>
        </>
      ),
      code: TAGS,
      focus: [6, 7, 8, 9, 10, 11, 12],
      scene: (
        <AmbientSpan
          lanes={process(
            [
              {
                id: 'alice',
                identity: 'alice',
                tags: { feature: 'chat' },
                start: 8,
                end: 78,
              },
            ],
            [
              { at: 22, label: 'ambient()', lands: 'alice' },
              { at: 58, label: 'completion · feature: chat', lands: 'alice' },
            ],
          )}
        />
      ),
    },
    {
      id: 'nested',
      prose: (
        <>
          <p>
            Spans nest. Inside alice&apos;s run, a run as nightly pushes
            nightly; when it returns, alice is current again. Nested runs of the
            same identity inherit the outer tags, and inner tags win.
          </p>
          <p>
            Concurrent runs never see each other. Two requests in flight each
            get their own actor, because the context follows the async call
            chain, not the process.
          </p>
        </>
      ),
      code: NESTED,
      focus: [6, 7, 8, 9, 10, 11, 13, 14, 15, 16],
      scene: (
        <AmbientSpan
          lanes={[
            lane(
              'nest',
              'nested',
              [
                {
                  id: 'alice',
                  identity: 'alice',
                  start: 6,
                  end: 80,
                  nested: [
                    { id: 'nightly', identity: 'nightly', start: 30, end: 60 },
                  ],
                },
              ],
              [
                { at: 44, label: 'current()', lands: 'nightly' },
                { at: 70, label: 'current()', lands: 'alice' },
              ],
            ),
            lane(
              'a',
              'concurrent · request a',
              [{ id: 'alice2', identity: 'alice', start: 10, end: 62 }],
              [{ at: 40, label: 'record', lands: 'alice' }],
            ),
            lane(
              'b',
              'concurrent · request b',
              [{ id: 'bob', identity: 'bob', start: 24, end: 88 }],
              [{ at: 52, label: 'record', lands: 'bob' }],
            ),
          ]}
        />
      ),
    },
    {
      id: 'ensure',
      prose: (
        <>
          <p>
            {code('ensure')} creates an identity if it is missing. Given no
            parent, it takes the ambient identity as the parent, so a span is
            also where children are born.
          </p>
          <p>
            Outside any span, with no parent, {code('ensure')} refuses rather
            than guess: creating a root is a deliberate {code('client.root()')}.
          </p>
        </>
      ),
      code: ENSURE,
      focus: [7, 11],
      scene: (
        <AmbientSpan
          lanes={process(
            [{ id: 'alice', identity: 'alice', start: 8, end: 68 }],
            [
              { at: 30, label: 'ensure(nightly) · parent', lands: 'alice' },
              { at: 84, label: 'ensure(orphan) · no_scope', lands: null },
            ],
          )}
        />
      ),
    },
    {
      id: 'middleware',
      prose: (
        <>
          <p>
            On a server, one middleware does it for every request. It resolves
            the identity from the request, ensures it under the parent you name,
            and runs the rest of the handler inside its span.
          </p>
          <p>
            Handlers then read {code('client.current()')} and never touch a user
            id. A resolver that throws is passed to {code('next(error)')}.
          </p>
        </>
      ),
      code: MIDDLEWARE,
      file: 'server.ts',
      focus: [6, 7, 8, 9, 10, 11, 12, 15],
      scene: (
        <AmbientSpan
          lanes={[
            lane(
              'req',
              'POST /crawl · x-user: alice',
              [
                {
                  id: 'alice',
                  identity: 'alice',
                  tags: { route: '/crawl' },
                  start: 26,
                  end: 92,
                },
              ],
              [
                { at: 14, label: 'middleware · ensure', lands: 'alice' },
                { at: 60, label: 'handler · record', lands: 'alice' },
              ],
            ),
          ]}
        />
      ),
    },
    {
      id: 'headers',
      prose: (
        <>
          <p>
            A span ends at the process boundary. To carry the identity across,{' '}
            {code('headers()')} gives you the one header that names it, and{' '}
            {code('client.from(headers)')} on the other side hands back the same
            scope.
          </p>
          <p>
            Both processes hold a client of the same config. Nothing about the
            identity is looked up; the id is the handle.
          </p>
        </>
      ),
      code: HEADERS,
      file: 'jobs.ts',
      focus: [5, 11, 12],
      scene: (
        <AmbientSpan
          lanes={[
            lane(
              'api',
              'api process',
              [{ id: 'alice', identity: 'alice', start: 6, end: 54 }],
              [{ at: 44, label: 'fetch(worker)', lands: 'alice' }],
            ),
            lane(
              'worker',
              'worker process',
              [{ id: 'alice-w', identity: 'alice', start: 50, end: 94 }],
              [{ at: 74, label: 'record', lands: 'alice' }],
            ),
          ]}
          crossing={{
            from: 'api',
            to: 'worker',
            at: 46,
            header: `${IDENTITY_HEADER}: alice`,
          }}
        />
      ),
    },
    {
      id: 'outside',
      prose: (
        <>
          <p>
            Outside every span there is no actor. {code('ambient()')} is
            undefined and {code('current()')} throws a {code('VoidError')} with{' '}
            {code("reason: 'no_scope'")}. Nothing falls back to a default
            identity.
          </p>
          <p>
            The context belongs to the client that opened the span. A second
            client, even of the same config, sees nothing. The LLM plugin&apos;s
            capture relies on all of this: it records each model call as whoever
            is ambient.
          </p>
        </>
      ),
      code: OUTSIDE,
      focus: [6, 7, 9, 10, 11, 12],
      scene: (
        <AmbientSpan
          lanes={process(
            [],
            [
              { at: 24, label: 'ambient() · undefined', lands: null },
              { at: 64, label: 'current() · no_scope', lands: null },
            ],
          )}
        />
      ),
    },
  ],
}
