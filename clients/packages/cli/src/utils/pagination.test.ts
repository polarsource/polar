import { describe, expect, vi, test } from 'vitest'
import { fetchAllPages, promiseAllInBatches } from '@/utils/pagination'

describe('promiseAllInBatches', () => {
  test('preserves order while limiting concurrency', async () => {
    let running = 0
    let peak = 0
    const task = async (item: number) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 1))
      running--
      return item * 2
    }

    await expect(
      promiseAllInBatches(task, [1, 2, 3, 4, 5], 2),
    ).resolves.toEqual([2, 4, 6, 8, 10])
    expect(peak).toBe(2)
  })
})

describe('fetchAllPages', () => {
  test('returns the first page when there is nothing more', async () => {
    const task = vi.fn(async () => ({ data: [1, 2], lastPage: 1 }))

    await expect(fetchAllPages(task)).resolves.toEqual([1, 2])
    expect(task).toHaveBeenCalledTimes(1)
  })

  test('returns an empty list when the first page has no data', async () => {
    await expect(fetchAllPages(async () => ({ lastPage: 3 }))).resolves.toEqual(
      [],
    )
  })

  test('collects the remaining pages in batches', async () => {
    let running = 0
    let peak = 0
    const task = vi.fn(async (page: number) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 1))
      running--
      return { data: page === 2 ? undefined : [page], lastPage: 5 }
    })

    await expect(
      fetchAllPages(task, { batchSize: 2, delayMs: 1 }),
    ).resolves.toEqual([1, 3, 4, 5])
    expect(task.mock.calls.map(([page]) => page)).toEqual([1, 2, 3, 4, 5])
    expect(peak).toBe(2)
  })

  test('retries a failing page before giving up', async () => {
    vi.useFakeTimers()
    let attempts = 0
    const task = async () => {
      attempts++
      if (attempts < 3) throw new Error(`attempt ${attempts}`)
      return { data: ['ok'], lastPage: 1 }
    }

    const result = fetchAllPages(task)
    await vi.runAllTimersAsync()
    await expect(result).resolves.toEqual(['ok'])
    expect(attempts).toBe(3)
    vi.useRealTimers()
  })

  test('surfaces the last error once retries are exhausted', async () => {
    vi.useFakeTimers()
    let attempts = 0
    const task = async () => {
      attempts++
      throw new Error(`attempt ${attempts}`)
    }

    const result = fetchAllPages(task)
    result.catch(() => {})
    await vi.runAllTimersAsync()
    await expect(result).rejects.toThrow('attempt 6')
    vi.useRealTimers()
  })
})
