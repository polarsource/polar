import type { Lesson } from '@/lesson/types'
import type { StreamEvent } from '@/scenes/fold'
import { ReducerStream } from '@/scenes/ReducerStream'
import {
  compile,
  count,
  defineConfig,
  derive,
  event,
  gt,
  map,
  on,
  sum,
} from '@void/sdk/config'
import { code } from './code'

/*
 * The real definitions. The scene folds a fixed stream of events through
 * their compiled form, so every number the reader sees comes from the SDK's
 * reducers, not from the prose.
 */
export const page = event<{ bytes: number; status: string }>('crawl.page')
export const bytes = sum('bytes', page, 'bytes')
export const total = count('total', page)
export const indexed = count('indexed', on(page, { status: 'ok' }))
export const large = count('large', on(page, { bytes: gt(100_000) }))
const kilobytes = map(on(page, { status: 'ok' }), { kb: '$bytes / 1024' })
export const kb = sum('kb', kilobytes, 'kb')
export const successRate = derive(
  'success-rate',
  { indexed, total },
  '$indexed / $total * 100',
)

export const stages = {
  event: defineConfig({ schema: { page } }),
  sum: defineConfig({ schema: { page, bytes } }),
  filter: defineConfig({ schema: { page, bytes, total, indexed } }),
  compare: defineConfig({ schema: { page, bytes, total, indexed, large } }),
  map: defineConfig({ schema: { page, bytes, total, indexed, large, kb } }),
  derive: defineConfig({
    schema: { page, bytes, total, indexed, large, kb, successRate },
  }),
}

/** What one identity recorded, in order. */
export const stream: readonly StreamEvent[] = [
  { id: 'e1', name: 'crawl.page', metadata: { bytes: 48_211, status: 'ok' } },
  { id: 'e2', name: 'crawl.page', metadata: { bytes: 120_500, status: 'ok' } },
  { id: 'e3', name: 'crawl.page', metadata: { bytes: 3_020, status: 'error' } },
  { id: 'e4', name: 'crawl.page', metadata: { bytes: 88_000, status: 'ok' } },
  {
    id: 'e5',
    name: 'crawl.page',
    metadata: { bytes: 250_000, status: 'error' },
  },
  { id: 'e6', name: 'crawl.page', metadata: { bytes: 12_400, status: 'ok' } },
]

const scene = (stage: keyof typeof stages, shown: number) => (
  <ReducerStream
    events={stream.slice(0, shown)}
    reducers={compile(stages[stage]).reducers}
  />
)

const EVENT = `import { event } from '@void/sdk'

export const page = event<{ bytes: number; status: string }>('crawl.page')
`

const SUM = `import { event, sum } from '@void/sdk'

export const page = event<{ bytes: number; status: string }>('crawl.page')

export const bytes = sum('bytes', page, 'bytes')
`

const FILTER = `import { count, event, on, sum } from '@void/sdk'

export const page = event<{ bytes: number; status: string }>('crawl.page')

export const bytes = sum('bytes', page, 'bytes')
export const total = count('total', page)
export const indexed = count('indexed', on(page, { status: 'ok' }))
`

const COMPARE = `import { count, event, gt, on, sum } from '@void/sdk'

export const page = event<{ bytes: number; status: string }>('crawl.page')

export const bytes = sum('bytes', page, 'bytes')
export const total = count('total', page)
export const indexed = count('indexed', on(page, { status: 'ok' }))
export const large = count('large', on(page, { bytes: gt(100_000) }))
`

const MAP = `import { count, event, gt, map, on, sum } from '@void/sdk'

export const page = event<{ bytes: number; status: string }>('crawl.page')

export const bytes = sum('bytes', page, 'bytes')
export const total = count('total', page)
export const indexed = count('indexed', on(page, { status: 'ok' }))
export const large = count('large', on(page, { bytes: gt(100_000) }))

const kilobytes = map(on(page, { status: 'ok' }), { kb: '$bytes / 1024' })
export const kb = sum('kb', kilobytes, 'kb')
`

const DERIVE = `import { count, derive, event, gt, map, on, sum } from '@void/sdk'

export const page = event<{ bytes: number; status: string }>('crawl.page')

export const bytes = sum('bytes', page, 'bytes')
export const total = count('total', page)
export const indexed = count('indexed', on(page, { status: 'ok' }))
export const large = count('large', on(page, { bytes: gt(100_000) }))

const kilobytes = map(on(page, { status: 'ok' }), { kb: '$bytes / 1024' })
export const kb = sum('kb', kilobytes, 'kb')

export const successRate = derive(
  'success-rate',
  { indexed, total },
  '$indexed / $total * 100',
)
`

const shownReducers = new Set(['indexed', 'kb', 'success-rate'])
const JSON_IR = JSON.stringify(
  compile(stages.derive).reducers.filter((r) => shownReducers.has(r.slug)),
  null,
  2,
)

export const reducersLesson: Lesson = {
  slug: 'reducers',
  title: 'Events and reducers',
  summary: 'Filter a stream of events and fold it into one number.',
  steps: [
    {
      id: 'event',
      prose: (
        <>
          <p>
            Everything in Void starts as an event: a name and some metadata,
            recorded against one identity. Your app records them, Void keeps
            them.
          </p>
          <p>
            On their own they are a log. Nothing on the right knows what to do
            with them yet.
          </p>
        </>
      ),
      code: EVENT,
      focus: [3],
      scene: scene('event', 2),
    },
    {
      id: 'sum',
      prose: (
        <>
          <p>
            A reducer folds the stream into one number per identity.{' '}
            {code('sum')} reads one metadata field of every matching event and
            adds it up.
          </p>
          <p>
            The first argument is the slug: the reducer&apos;s name on the
            server, and the name your client reads it back by.
          </p>
        </>
      ),
      code: SUM,
      focus: [5],
      scene: scene('sum', 3),
    },
    {
      id: 'filter',
      prose: (
        <>
          <p>
            {code('on')} narrows what a reducer sees. Field values match
            exactly, so {code('indexed')} counts only pages that came back ok,
            while {code('total')} counts every page.
          </p>
          <p>
            The page that failed passes one and is filtered out of the other.
            Both are {code('count')}, which never reads a field.
          </p>
        </>
      ),
      code: FILTER,
      focus: [6, 7],
      scene: scene('filter', 4),
    },
    {
      id: 'compare',
      prose: (
        <>
          <p>
            Comparisons cover the rest: {code('gt')}, {code('gte')},{' '}
            {code('lt')}, {code('lte')}, {code('not')} and {code('like')}.
            Several fields in one matcher must all hold.
          </p>
          <p>
            A filter compiles to plain clauses. The server evaluates them on
            every event as it arrives, and nothing is re-read later.
          </p>
        </>
      ),
      code: COMPARE,
      focus: [8],
      scene: scene('compare', 5),
    },
    {
      id: 'map',
      prose: (
        <>
          <p>
            {code('map')} reshapes metadata before the aggregation reads it. The
            filter still sees the original event; the projection replaces it
            afterwards.
          </p>
          <p>
            {code('$bytes')} reads a field. The arithmetic is a small grammar of
            its own, never JavaScript. A value it cannot compute becomes null,
            and {code('sum')} skips it.
          </p>
        </>
      ),
      code: MAP,
      focus: [10, 11],
      scene: scene('map', 6),
    },
    {
      id: 'derive',
      prose: (
        <>
          <p>
            {code('derive')} computes one number from other named reducers. The
            inputs are collected into the config for you.
          </p>
          <p>
            The server stores the inputs, not the result, and recomputes the
            formula when either changes. Two periods at 2/10 and 3/90 merge as
            5/100, not as the average of two percentages.
          </p>
        </>
      ),
      code: DERIVE,
      focus: [13, 14, 15, 16, 17],
      scene: scene('derive', 6),
    },
    {
      id: 'compiled',
      prose: (
        <>
          <p>
            This is what {code('void deploy')} sends for three of them: a slug,
            a filter of clauses, an optional map, one aggregation. A derived
            reducer names its inputs by slug.
          </p>
          <p>
            The slug is the identity. Change a deployed reducer&apos;s filter,
            map or aggregation and it needs a new slug; the old one keeps its
            history.
          </p>
        </>
      ),
      code: JSON_IR,
      lang: 'json',
      file: 'void.json',
      layout: 'code',
    },
  ],
}
