import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, assert, describe, it } from 'vitest'
import { checksum, compile } from '../src/config/compile'
import type { Config } from '../src/config/config'
import { toSource } from '../src/config/codegen'
import { normalizeIr, parseIr } from '../src/config/ir'
import { config as exampleConfig } from '../example/void'
import { config as deploymentConfig } from './fixtures/deployment'
import {
  count,
  defineConfig,
  derive,
  entitlement,
  event,
  gt,
  like,
  map,
  meter,
  money,
  not,
  on,
  oneTime,
  product,
  recent,
  signal,
  sum,
} from '../src/config/index'

const dir = await mkdtemp(join(tmpdir(), 'void-codegen-'))
afterAll(() => rm(dir, { recursive: true, force: true }))

/** Writes the generated module beside the test and loads it back. */
const roundTrip = async (name: string, config: Config) => {
  const ir = compile(config)
  const file = join(dir, `${name}.ts`)
  const from = join(import.meta.dirname, '../src/config/index')
  await writeFile(file, toSource(ir, { from, source: 'v' }))
  const module = (await import(pathToFileURL(file).href)) as {
    config: Config
  }
  return { ir, generated: compile(module.config) }
}

const page = event<{ bytes: number; host: string; status?: string }>(
  'corner.page',
)
const purchase = event<{ amount: number; note: string }>('corner.purchase')
// A shared reducer, referenced by two meters, stays a named export.
const bytes = sum('corner-bytes', page, 'bytes')
const granted = sum('corner-granted', purchase, 'amount')
const okCount = count('corner-ok', on(page, { status: 'ok' }))
// A meter referenced only by signals still round-trips.
const signalMeter = meter('corner-signal-meter', {
  reducer: bytes,
  price: money('eur', 0.1),
})
// A slug that collides with a helper.
const sumEntitlement = entitlement('sum', {
  description: 'Named like a helper',
})
const cornerCases = defineConfig({
  schema: {
    page,
    purchase,
    bytes,
    big: meter('corner-big', { reducer: bytes, price: money('eur', 0.5) }),
    small: meter('corner-small', { reducer: bytes, price: money('eur', 0.25) }),
    // Comparisons, several on one property, and a mapped projection.
    filtered: count(
      'corner-filtered',
      on(page, { status: 'ok', bytes: [gt(10), not(42)], host: like('%.io') }),
    ),
    doubled: meter('corner-doubled', {
      reducer: sum(map(page, { twice: '$bytes * 2' }), 'twice'),
      price: { amount: 0 },
    }),
    // An adopted credit reducer and a derived metric.
    granted,
    wallet: meter('corner-wallet', {
      reducer: sum(page, 'bytes'),
      creditReducer: granted,
      price: { amount: 0 },
    }),
    ratio: derive(
      'corner-ratio',
      { ok: okCount, all: count('corner-all', page) },
      '$ok / $all',
    ),
    sumEntitlement,
    // A slug that starts with a digit, on a one-time product in another currency.
    lifetime: product('2-lifetime', {
      name: 'Lifetime',
      price: oneTime({ amount: money('eur', 199) }),
      entitlements: [sumEntitlement],
    }),
    // A meter signal (default field) and a semantic signal with a custom window.
    lowSignal: signal('corner-low', {
      meter: signalMeter,
      field: 'remaining',
      enter: { below: 100 },
      exit: { atLeast: 500 },
    }),
    abuseSignal: signal('corner-abuse', {
      meter: signalMeter,
      when: 'Is this identity abusing the service?',
      over: recent(2, 'day'),
      enter: { above: 0.9 },
      exit: { below: 0.3 },
    }),
  },
})

describe('toSource', () => {
  it.each([
    ['example', exampleConfig as Config],
    ['deployment', deploymentConfig],
    ['corner cases', cornerCases],
  ])(
    'round-trips the %s config through generated TypeScript',
    async (name, config) => {
      const { ir, generated } = await roundTrip(name.replace(' ', '-'), config)
      // A classifier rides on its llm plugin, which generated source does
      // not recover; the source carries a TODO for it instead.
      const { activities: _activities, ...recoverable } = ir
      assert.deepEqual(generated, recoverable)
      assert.equal(checksum(generated), checksum(recoverable))
    },
  )

  it('flags a classifier the plugin has to declare', () => {
    const source = toSource(compile(exampleConfig as Config))
    assert.match(
      source,
      /TODO: sdk_demo_llm classifies sdk_demo_llm.completion; set classify: true on the llm plugin/,
    )
  })

  it('flags a filter the define API cannot express', () => {
    const ir = compile(deploymentConfig)
    const reducer = {
      ...ir.reducers[0]!,
      filter: { ...ir.reducers[0]!.filter!, conjunction: 'or' as const },
    }
    const source = toSource({ ...ir, reducers: [reducer] })
    assert.match(
      source,
      /TODO: the deployed filter joins its clauses with "or"/,
    )
  })
})

describe('normalizeIr', () => {
  it('accepts the stored deploy body and derives the events', () => {
    const ir = compile(deploymentConfig)
    const stored = JSON.parse(
      JSON.stringify({
        reducers: ir.reducers.map((r) => ({ ...r, map: null })),
        meters: ir.meters.map((m) => ({
          ...m,
          unit_amount: String(m.unit_amount),
          credit_reducer: null,
        })),
        entitlements: ir.entitlements.map((e) => ({ ...e, description: null })),
        products: ir.products.map((p) => ({
          ...p,
          description: null,
          price: { ...p.price, amount: String(p.price.amount) },
        })),
      }),
    )
    assert.deepEqual(normalizeIr(stored), ir)
  })

  it('reads a void.json and rejects other versions', () => {
    const ir = compile(deploymentConfig)
    assert.deepEqual(parseIr(JSON.parse(JSON.stringify(ir))), ir)
    assert.throws(() => parseIr({ ...ir, version: 3 }), /"version": 4/)
    assert.throws(() => parseIr([]), /must be an object/)
  })
})
