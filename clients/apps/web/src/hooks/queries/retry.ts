import {
  NotFoundResponseError,
  UnauthorizedResponseError,
} from '@polar-sh/client'

export const authenticatingRetry = (
  failureCount: number,
  error: Error,
): boolean => {
  if (error instanceof UnauthorizedResponseError) {
    return false
  }

  if (error instanceof NotFoundResponseError) {
    return false
  }

  if (failureCount > 2) {
    return false
  }

  return true
}

export const defaultRetry = authenticatingRetry
