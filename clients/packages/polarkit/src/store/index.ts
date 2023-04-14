import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { CONFIG } from '../config'
import {
  ContextState,
  createUserContextSlice,
  UserContextState,
  UserState,
} from './userContext'

// https://docs.pmnd.rs/zustand/guides/typescript#slices-pattern
const useStore = create<UserContextState>()(
  devtools(
    persist(
      (...a) => ({
        ...createUserContextSlice(...a),
      }),
      {
        name: CONFIG.LOCALSTORAGE_PERSIST_KEY,
        version: CONFIG.LOCALSTORAGE_PERSIST_VERSION,
        partialize: (state) => ({
          authenticated: state.authenticated,
          currentUser: state.currentUser,
        }),
      },
    ),
  ),
)

export { useStore }
export type { UserState, ContextState, UserContextState }
