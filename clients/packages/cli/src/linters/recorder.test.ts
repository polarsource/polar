import { describe, expect, test } from 'vitest'
import { BlockedError, record } from '@/linters/recorder'

const rules = (observations: ReadonlyArray<{ rule: string }>) =>
  observations.map(({ rule }) => rule)

describe('record', () => {
  test('observes clock, random and environment reads and lets them run', async () => {
    const { value, failure, observations } = await record(async () => ({
      now: Date.now(),
      fresh: new Date(),
      fixed: new Date(2030, 0, 1),
      roll: Math.random(),
      home: process.env['HOME'],
    }))
    expect(failure).toBeUndefined()
    expect(typeof value?.now).toBe('number')
    expect(value?.fixed.getFullYear()).toBe(2030)
    expect(rules(observations)).toEqual([
      'reads_clock',
      'reads_clock',
      'reads_random',
      'reads_environment',
    ])
  })

  test('blocks network requests', async () => {
    const { failure, observations } = await record(async () =>
      fetch('https://example.com'),
    )
    expect(failure).toBeInstanceOf(BlockedError)
    expect(rules(observations)).toEqual(['reads_network'])
  })

  test('restores the globals afterwards', async () => {
    const now = Date.now
    const date = Date
    const env = process.env
    await record(async () => Date.now())
    expect(Date.now).toBe(now)
    expect(Date).toBe(date)
    expect(process.env).toBe(env)
  })
})
