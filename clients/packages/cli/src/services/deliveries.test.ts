import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Option } from 'effect'
import { type Delivery, make } from '@/services/deliveries'

const eventId = '0b4f2f4e-8f4c-4f3e-9d6e-2c5c1c7e9a10'
const delivery: Delivery = {
  forwardUrl: 'http://localhost:3000/webhooks',
  status: 200,
  statusText: 'OK',
  durationMs: 6,
}

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'polar-deliveries-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('deliveries', () => {
  test('hands a recorded delivery to the trigger and cleans it up', async () => {
    const deliveries = make(directory, '1 second')
    await Effect.runPromise(deliveries.record(eventId, delivery))

    expect(await Effect.runPromise(deliveries.await(eventId))).toEqual(
      Option.some(delivery),
    )
    expect(await readdir(directory)).toEqual([])
  })

  test('keeps the response body of a rejected delivery', async () => {
    const deliveries = make(directory, '1 second')
    const rejected: Delivery = {
      ...delivery,
      status: 500,
      statusText: 'Internal Server Error',
      body: 'boom',
    }
    await Effect.runPromise(deliveries.record(eventId, rejected))

    expect(await Effect.runPromise(deliveries.await(eventId))).toEqual(
      Option.some(rejected),
    )
  })

  test.skipIf(process.platform === 'win32')(
    'keeps recorded deliveries readable by the current user only',
    async () => {
      const nested = join(directory, 'deliveries')
      await Effect.runPromise(make(nested).record(eventId, delivery))

      const mode = async (path: string) => (await stat(path)).mode & 0o777
      expect(await mode(nested)).toBe(0o700)
      expect(await mode(join(nested, `${eventId}.json`))).toBe(0o600)
    },
  )

  test('waits for a delivery that is recorded a moment later', async () => {
    const deliveries = make(directory, '1 second')
    setTimeout(() => {
      void Effect.runPromise(deliveries.record(eventId, delivery))
    }, 150)

    expect(await Effect.runPromise(deliveries.await(eventId))).toEqual(
      Option.some(delivery),
    )
  })

  test('gives up when no delivery is recorded in time', async () => {
    const deliveries = make(directory, '200 millis')
    expect(await Effect.runPromise(deliveries.await(eventId))).toEqual(
      Option.none(),
    )
  })

  test('ignores a file that is not a delivery', async () => {
    await writeFile(join(directory, `${eventId}.json`), '{"nope":true}')
    const deliveries = make(directory, '200 millis')
    expect(await Effect.runPromise(deliveries.await(eventId))).toEqual(
      Option.none(),
    )
  })

  test('only accepts event IDs as file names', async () => {
    const deliveries = make(directory, '200 millis')
    await Effect.runPromise(deliveries.record('../../escape', delivery))

    expect(await readdir(directory)).toEqual([])
    expect(await Effect.runPromise(deliveries.await('../../escape'))).toEqual(
      Option.none(),
    )
  })
})
