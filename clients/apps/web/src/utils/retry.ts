export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  {
    maxRetries = 3,
    initialDelayMs = 100,
    maxDelayMs = 1000,
  }: RetryOptions = {},
): Promise<T> {
  const attempt = async (remaining: number, delay: number): Promise<T> => {
    try {
      return await fn()
    } catch (error) {
      if (remaining <= 0) throw error
      await new Promise((resolve) => setTimeout(resolve, delay))
      return attempt(remaining - 1, Math.min(delay * 2, maxDelayMs))
    }
  }
  return attempt(maxRetries, initialDelayMs)
}
