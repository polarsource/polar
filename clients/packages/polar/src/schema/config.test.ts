import { expect, test } from 'vitest'
import { defineConfig } from './config'
import { gte } from './meter'

test('config serializes to JSON without exposing mutable internal data', () => {
  const config = defineConfig({
    meters: ({ meter }) => ({
      tokens: meter().count(),
    }),
  })
  const json = config.toJSON()
  expect(json.meters[0]?.name).toBe('tokens')
  expect(JSON.parse(JSON.stringify(config))).toEqual(json)
  Reflect.set(json.meters, 'length', 0)
  expect(config.toJSON().meters).toHaveLength(1)
})

test('connect rejects duplicate IDs without changing JSON serialization', () => {
  const config = defineConfig({
    meters: ({ meter }) => [
      ['calls', meter({ displayName: 'First' }).count()],
      ['calls', meter({ displayName: 'Second' }).count()],
    ],
  })
  expect(config.toJSON().meters).toHaveLength(2)
  expect(() => config.connect({ accessToken: 'test' })).toThrow(
    'duplicate meter external IDs',
  )
})

test('defineConfig rejects invalid builder values', () => {
  expect(() =>
    defineConfig({
      meters: ({ meter }) => ({
        tokens: meter().where(gte('tokens', 1.5)).count(),
      }),
    }),
  ).toThrow()
})
