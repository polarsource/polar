export const isExpiredCheckoutError = (
  error: unknown,
): error is { error: 'ExpiredCheckoutError'; detail: string } => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    (error as { error: unknown }).error === 'ExpiredCheckoutError'
  )
}
