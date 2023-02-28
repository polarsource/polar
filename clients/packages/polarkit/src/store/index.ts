import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { AuthSlice, createAuthSlice } from './auth'
import { ContextSlice, createContextSlice } from './context'

// https://docs.pmnd.rs/zustand/guides/typescript#slices-pattern
const useStore = create<AuthSlice & ContextSlice>()(
  devtools(
    persist(
      (...a) => ({
        ...createAuthSlice(...a),
        ...createContextSlice(...a),
      }),
      {
        name: 'polar',
      },
    ),
  ),
)

export { useStore }
export type { AuthSlice }
