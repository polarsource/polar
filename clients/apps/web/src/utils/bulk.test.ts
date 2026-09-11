import { describe, expect, it, vi } from 'vitest'
import { runBulk } from './bulk'

const account = <T>(result: {
  succeeded: { item: T }[]
  failed: { item: T }[]
  cancelled: T[]
}) =>
  [
    ...result.succeeded.map((entry) => entry.item),
    ...result.failed.map((entry) => entry.item),
    ...result.cancelled,
  ].sort()

describe('runBulk', () => {
  it('accounts for every input on success and failure', async () => {
    const result = await runBulk([1, 2, 3], async (item) => {
      if (item === 2) {
        throw new Error('boom')
      }
      return item * 2
    })

    expect(result.succeeded).toEqual([
      { item: 1, value: 2 },
      { item: 3, value: 6 },
    ])
    expect(result.failed).toEqual([{ item: 2, error: expect.any(Error) }])
    expect(result.cancelled).toEqual([])
    expect(account(result)).toEqual([1, 2, 3])
  })

  it('puts never-started and abort-rejected items in cancelled', async () => {
    const controller = new AbortController()
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let inFlight = 0

    const runPromise = runBulk(
      [1, 2, 3, 4],
      async (item, signal) => {
        inFlight += 1
        if (item === 1) {
          await firstGate
          return item
        }
        await new Promise<never>((_, reject) => {
          signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          )
        })
        return item
      },
      { concurrency: 2, signal: controller.signal },
    )

    await vi.waitFor(() => {
      expect(inFlight).toBe(2)
    })

    controller.abort()
    releaseFirst()

    const result = await runPromise

    expect(result.succeeded).toEqual([{ item: 1, value: 1 }])
    expect(result.failed).toEqual([])
    expect([...result.cancelled].sort()).toEqual([2, 3, 4])
    expect(account(result)).toEqual([1, 2, 3, 4])
  })

  it('cancels every item when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    const run = vi.fn(async (item: number) => item)
    const result = await runBulk([1, 2, 3], run, {
      signal: controller.signal,
    })

    expect(run).not.toHaveBeenCalled()
    expect(result).toEqual({
      succeeded: [],
      failed: [],
      cancelled: [1, 2, 3],
    })
  })
})
