import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { AuthSlice, createAuthSlice } from './auth'

// https://docs.pmnd.rs/zustand/guides/typescript#slices-pattern
const useStore = create<AuthSlice>()(
  devtools(
    persist(
      (...a) => ({
        ...createAuthSlice(...a),
      }),
      {
        name: 'polar',
      },
    ),
  ),
)

export { useStore }
export type { AuthSlice }
