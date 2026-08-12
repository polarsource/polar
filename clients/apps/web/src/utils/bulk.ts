export interface BulkResult<T, R = void> {
  succeeded: { item: T; value: R }[]
  failed: { item: T; error: unknown }[]
  cancelled: T[]
}

export const runBulk = async <T, R = void>(
  items: readonly T[],
  run: (item: T, signal?: AbortSignal) => Promise<R>,
  {
    concurrency = 8,
    signal,
  }: { concurrency?: number; signal?: AbortSignal } = {},
): Promise<BulkResult<T, R>> => {
  const result: BulkResult<T, R> = {
    succeeded: [],
    failed: [],
    cancelled: [],
  }
  if (items.length === 0) {
    return result
  }

  const limit = Math.max(1, Math.min(concurrency, items.length))
  let cursor = 0

  const worker = async () => {
    while (cursor < items.length) {
      if (signal?.aborted) {
        return
      }
      const item = items[cursor]
      cursor += 1
      try {
        const value = await run(item, signal)
        result.succeeded.push({ item, value })
      } catch (error) {
        if (signal?.aborted) {
          result.cancelled.push(item)
          return
        }
        result.failed.push({ item, error })
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, worker))

  if (cursor < items.length) {
    result.cancelled.push(...items.slice(cursor))
  }

  return result
}
