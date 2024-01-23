import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { CONFIG } from '../config'
import { FormDraftSlice, createFormDraftSlice } from './formDraftSlice'
import { UserSlice, UserState, createUserSlice } from './userContext'

// https://docs.pmnd.rs/zustand/guides/typescript#slices-pattern
const useStore = create<UserSlice & FormDraftSlice>()(
  devtools(
    persist(
      (...a) => ({
        ...createUserSlice(...a),
        ...createFormDraftSlice(...a),
      }),
      {
        name: CONFIG.LOCALSTORAGE_PERSIST_KEY,
        version: CONFIG.LOCALSTORAGE_PERSIST_VERSION,
        partialize: (state) => ({
          // From UserSlice
          authenticated: state.authenticated,
          currentUser: state.currentUser,
          onboardingDashboardSkip: state.onboardingDashboardSkip,
          onboardingDashboardInstallChromeExtensionSkip:
            state.onboardingDashboardInstallChromeExtensionSkip,
          onboardingMaintainerConnectRepositoriesSkip:
            state.onboardingMaintainerConnectRepositoriesSkip,
          formDrafts: state.formDrafts,
        }),
      },
    ),
  ),
)

export { useStore }
export type { UserSlice, UserState }
