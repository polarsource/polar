import { StateCreator } from 'zustand'
import { UserRead } from '../api/client'
import { api, CancelablePromise } from '../api'

export interface AuthSlice {
  authenticated: boolean
  user: UserRead | null
  login: (
    callback?: (authenticated: boolean) => void,
  ) => CancelablePromise<UserRead>
  logout: (
    callback?: (authenticated: boolean) => void,
  ) => CancelablePromise<any>
}

export const createAuthSlice: StateCreator<AuthSlice> = (set, get) => ({
  authenticated: false,
  user: null,
  login: (
    callback?: (authenticated: boolean) => void,
  ): CancelablePromise<UserRead> => {
    const request = api.users.getAuthenticated()
    request
      .then((user) => {
        set({ authenticated: true, user })
      })
      .catch((err) => {
        set({ authenticated: false, user: null })
      })
      .finally(() => {
        if (callback) {
          callback(get().authenticated)
        }
      })
    return request
  },
  logout: (): CancelablePromise<any> => {
    const request = api.users.logout()
    request.finally(() => {
      set({ authenticated: false, user: null })
    })
    return request
  },
})
