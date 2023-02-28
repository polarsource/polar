import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import {
  UserState,
  ContextState,
  UserContextState,
  createUserContextSlice,
} from './userContext'
import { CONFIG } from '../config'

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
      },
    ),
  ),
)

export { useStore }
export type { UserState, ContextState, UserContextState }
