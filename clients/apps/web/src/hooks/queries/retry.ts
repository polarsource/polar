import { useStore } from '@/store'
import { ResponseError } from '@polar-sh/sdk'

export const authenticatingRetry = (
  failureCount: number,
  error: ResponseError, // TODO: This type is not correct
): boolean => {
  if (error?.response?.status === 401) {
    // Empty Zustand store on unauthenticated errors
    const state = useStore.getState()
    if (state.resetState) {
      state.resetState()
    }
    return false
  }

  if (error?.response?.status === 404) {
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
  error: ResponseError, // TODO: This type is not correct
): boolean => {
  if (error?.response?.status === 401) {
    return false
  }

  if (error?.response?.status === 404) {
    return false
  }

  if (failureCount > 2) {
    return false
  }

  return true
}
