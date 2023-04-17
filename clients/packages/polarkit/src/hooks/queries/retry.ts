import { ApiError } from '../../api/client'

export const defaultRetry = (
  failureCount: number,
  error: ApiError,
): boolean => {
  if (error.status === 404) {
    return false
  }
  if (failureCount > 2) {
    return false
  }
  return true
}
