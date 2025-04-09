import { CONFIG } from '@/utils/config'
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { FormDraftSlice, createFormDraftSlice } from './formDraftSlice'

// https://docs.pmnd.rs/zustand/guides/typescript#slices-pattern
const useStore = create<FormDraftSlice>()(
  devtools(
    persist(
      (...a) => ({
        ...createFormDraftSlice(...a),
      }),
      {
        name: CONFIG.LOCALSTORAGE_PERSIST_KEY,
        version: CONFIG.LOCALSTORAGE_PERSIST_VERSION,
        partialize: (state) => ({
          formDrafts: state.formDrafts,
        }),
      },
    ),
  ),
)

export { useStore }
