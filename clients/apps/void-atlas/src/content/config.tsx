import type { Lesson } from '@/lesson/types'
import { ConfigToIr } from '@/scenes/ConfigToIr'
import {
  checksumOf,
  compile,
  count,
  defineConfig,
  event,
  meter,
  on,
  sum,
  usd,
} from '@void/sdk/config'
import { code } from './code'

/*
 * The definitions the reader watches being written. They are the real thing:
 * the scene compiles them with the SDK, so the IR on screen is what
 * `void deploy` would send.
 */
export const page = event<{ bytes: number; status?: string }>('crawl.page')
export const bandwidth = meter('bandwidth', {
  reducer: sum(page, 'bytes'),
  price: usd(0.00000008),
})
export const indexed = count('indexed', on(page, { status: 'ok' }))

/** The module at each stage. `defineConfig` only appears in the file at stage 3. */
export const stages = {
  event: defineConfig({ schema: { page } }),
  meter: defineConfig({ schema: { page, bandwidth } }),
  config: defineConfig({ schema: { page, bandwidth } }),
  more: defineConfig({ schema: { page, bandwidth, indexed } }),
}

const EVENT = `import { event } from '@void/sdk'

export const page = event<{ bytes: number; status?: string }>('crawl.page')
`

const METER = `import { event, meter, sum, usd } from '@void/sdk'

export const page = event<{ bytes: number; status?: string }>('crawl.page')

export const bandwidth = meter('bandwidth', {
  reducer: sum(page, 'bytes'),
  price: usd(0.00000008),
})
`

const CONFIG = `import { event, meter, sum, usd } from '@void/sdk'
import { defineConfig } from '@void/sdk/config'

export const page = event<{ bytes: number; status?: string }>('crawl.page')

export const bandwidth = meter('bandwidth', {
  reducer: sum(page, 'bytes'),
  price: usd(0.00000008),
})

export const config = defineConfig({
  schema: { page, bandwidth },
})
`

const MORE = `import { count, event, meter, on, sum, usd } from '@void/sdk'
import { defineConfig } from '@void/sdk/config'

export const page = event<{ bytes: number; status?: string }>('crawl.page')

export const bandwidth = meter('bandwidth', {
  reducer: sum(page, 'bytes'),
  price: usd(0.00000008),
})

export const indexed = count('indexed', on(page, { status: 'ok' }))

export const config = defineConfig({
  schema: { page, bandwidth, indexed },
})
`

export const configLesson: Lesson = {
  slug: 'config',
  title: 'Config',
  summary: 'A Void config is a TypeScript module. Here is what it compiles to.',
  steps: [
    {
      id: 'module',
      prose: (
        <>
          <p>
            A Void config is a TypeScript file. Every billable thing in your
            product is an exported value in it, and the CLI deploys the file.
          </p>
          <p>
            This chapter writes one from nothing and shows, on the right, what
            the SDK compiles it to at each step.
          </p>
        </>
      ),
      code: EVENT,
      focus: [3],
      scene: <ConfigToIr ir={compile(stages.event)} checksum={null} />,
    },
    {
      id: 'event',
      prose: (
        <>
          <p>
            Start with an event: a name and the shape of the metadata your app
            records with it. {code("'crawl.page'")} is what the server sees.
          </p>
          <p>
            The type parameter is for your editor. It is erased at deploy time,
            so only the name reaches the compiled form. Changing the type never
            changes a deployment.
          </p>
        </>
      ),
      focus: [3],
      scene: <ConfigToIr ir={compile(stages.event)} checksum={null} />,
    },
    {
      id: 'meter',
      prose: (
        <>
          <p>
            A meter prices a number. {code("sum(page, 'bytes')")} is a reducer:
            it folds every {code('crawl.page')} event into one running total per
            identity. The meter wraps it with a price per unit.
          </p>
          <p>
            The reducer was written inline, so it takes the meter&apos;s slug.
            Two entries appear on the right from one export.
          </p>
        </>
      ),
      code: METER,
      focus: [5, 6, 7, 8],
      scene: <ConfigToIr ir={compile(stages.meter)} checksum={null} />,
    },
    {
      id: 'define',
      prose: (
        <>
          <p>
            {code('defineConfig')} turns the module into a config. It walks the
            schema and keeps every Void definition it finds, including the
            reducer under the meter. Nothing is listed twice.
          </p>
          <p>
            This object is what {code('void deploy')} compiles and what{' '}
            {code('createVoid(config, …)')} uses at runtime. It now has a
            checksum.
          </p>
        </>
      ),
      code: CONFIG,
      focus: [2, 10, 11, 12],
      scene: (
        <ConfigToIr
          ir={compile(stages.config)}
          checksum={checksumOf(stages.config)}
        />
      ),
    },
    {
      id: 'more',
      prose: (
        <>
          <p>
            Add an export and it is deployed. {code('count')} with{' '}
            {code("on(page, { status: 'ok' })")} is a named reducer with a
            filter and no price, so it lands under reducers only.
          </p>
          <p>
            The compiled form changed, so the checksum did. That hash is the
            version every request carries. The next chapters explain each
            section of the file; the last one explains the hash.
          </p>
        </>
      ),
      code: MORE,
      focus: [1, 10, 13],
      scene: (
        <ConfigToIr
          ir={compile(stages.more)}
          checksum={checksumOf(stages.more)}
        />
      ),
    },
  ],
}
