export interface BulkResult<T> {
  succeeded: T[]
  failed: { item: T; error: unknown }[]
}

export const runBulk = async <T>(
  items: T[],
  run: (item: T) => Promise<{ error?: unknown }>,
  { concurrency = 8 }: { concurrency?: number } = {},
): Promise<BulkResult<T>> => {
  const result: BulkResult<T> = { succeeded: [], failed: [] }
  let cursor = 0
  const worker = async () => {
    while (cursor < items.length) {
      const item = items[cursor]
      cursor += 1
      try {
        const { error } = await run(item)
        if (error) {
          result.failed.push({ item, error })
        } else {
          result.succeeded.push(item)
        }
      } catch (error) {
        result.failed.push({ item, error })
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  )
  return result
}
