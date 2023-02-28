import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import {
  UserState,
  ContextState,
  UserContextState,
  createUserContextSlice,
} from './userContext'

// https://docs.pmnd.rs/zustand/guides/typescript#slices-pattern
const useStore = create<UserContextState>()(
  devtools(
    persist(
      (...a) => ({
        ...createUserContextSlice(...a),
      }),
      {
        name: 'polar',
      },
    ),
  ),
)

export { useStore }
export type { UserState, ContextState, UserContextState }
