import { StateCreator } from 'zustand'
import { UserRead } from '../api/client'
import { api } from '../api'

export interface AuthSlice {
  hasChecked: boolean
  authenticated: boolean
  user: UserRead | null
  login: (callback?: () => void) => void
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  hasChecked: false,
  authenticated: false,
  user: null,
  login: (callback?: () => void) => {
    api.users
      .getAuthenticated()
      .then((user) => {
        set({ authenticated: true, user })
      })
      .catch((err) => {
        set({ authenticated: false, user: null })
      })
      .finally(() => {
        set({ hasChecked: true })
        if (callback) {
          callback()
        }
      })
  },
})
