/**
 * Wraps an async function to ensure it takes at least a minimum duration.
 * Useful for loading states that shouldn't flash too quickly.
 *
 * @example
 * const save = async () => {
 *   await withMinDuration(
 *     () => updateCheckoutLink.mutateAsync(data),
 *     1500
 *   )
 *   toast.showInfo('Saved!')
 * }
 */
export async function withMinDuration<T>(
  fn: () => Promise<T>,
  minDuration: number,
): Promise<T> {
  const start = Date.now()
  const result = await fn()
  const elapsed = Date.now() - start
  const remaining = minDuration - elapsed

  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining))
  }

  return result
}
