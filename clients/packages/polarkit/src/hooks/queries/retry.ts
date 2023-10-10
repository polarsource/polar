import { ResponseError } from '../../api/client'
import { useStore } from '../../store'

export const defaultRetry = (
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
