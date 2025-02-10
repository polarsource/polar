import { useStore } from '@/store'
import {
  ClientResponseError,
  NotFoundResponseError,
  UnauthorizedResponseError,
} from '@polar-sh/client'

export const authenticatingRetry = (
  failureCount: number,
  // Errors that can be raised by `unwrap`.
  // API calls not wrapped by `unwrap` will succeed with an error object, so they won't be catched here.
  error:
    | ClientResponseError
    | UnauthorizedResponseError
    | NotFoundResponseError,
): boolean => {
  if (error instanceof UnauthorizedResponseError) {
    // Empty Zustand store on unauthenticated errors
    const state = useStore.getState()
    if (state.resetState) {
      state.resetState()
    }
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
