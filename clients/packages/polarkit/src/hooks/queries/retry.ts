import { ResponseError } from '@polar-sh/sdk'
import { useStore } from '../../store'

export const authenticatingRetry = (
  failureCount: number,
  error: ResponseError,
): boolean => {
  if (error.response.status === 401) {
    // Empty Zustand store on unauthenticated errors
    const state = useStore.getState()
    if (state.resetState) {
      state.resetState()
    }
    return false
  }

  if (error.response.status === 404) {
    return false
  }
  if (failureCount > 2) {
    return false
  }
  return true
}

export const defaultRetry = authenticatingRetry

export const serverErrorRetry = (
  failureCount: number,
  error: ResponseError,
): boolean => {
  if (error.response.status === 401) {
    return false
  }

  if (error.response.status === 404) {
    return false
  }

  if (failureCount > 2) {
    return false
  }

  return true
}
