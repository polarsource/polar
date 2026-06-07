import { describe, expect, test } from 'vitest'
import { configFromEnv, describeStore } from '../src/config'
import { createStore } from '../src/create-store'
import { MemoryEventStore } from '../src/store'

describe('store seam', () => {
  test('configFromEnv defaults to a sqlite store at local.db', () => {
    const config = configFromEnv({ POLAR_ACCESS_TOKEN: 'polar_test' })
    expect(config.store).toEqual({ kind: 'sqlite', path: 'local.db' })
  })

  test('LOCAL_DB_PATH overrides the sqlite path', () => {
    const config = configFromEnv({
      POLAR_ACCESS_TOKEN: 'polar_test',
      LOCAL_DB_PATH: '/data/usage.db',
    })
    expect(config.store).toEqual({ kind: 'sqlite', path: '/data/usage.db' })
  })

  test('LOCAL_STORE=memory selects the ephemeral store', () => {
    const config = configFromEnv({
      POLAR_ACCESS_TOKEN: 'polar_test',
      LOCAL_STORE: 'memory',
    })
    expect(config.store).toEqual({ kind: 'memory' })
    expect(createStore(config.store)).toBeInstanceOf(MemoryEventStore)
  })

  test('an unknown LOCAL_STORE fails fast', () => {
    expect(() =>
      configFromEnv({
        POLAR_ACCESS_TOKEN: 'polar_test',
        LOCAL_STORE: 'postgres',
      }),
    ).toThrow('LOCAL_STORE must be "sqlite" or "memory"')
  })

  test('describeStore renders a boot-log one-liner', () => {
    expect(describeStore({ kind: 'sqlite', path: 'local.db' })).toBe(
      'sqlite:local.db',
    )
    expect(describeStore({ kind: 'memory' })).toBe('memory (ephemeral)')
  })
})
