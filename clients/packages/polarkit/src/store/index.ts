import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { CONFIG } from '../config'
import { UserSlice, UserState, createUserSlice } from './userContext'

// https://docs.pmnd.rs/zustand/guides/typescript#slices-pattern
const useStore = create<UserSlice>()(
  devtools(
    persist(
      (...a) => ({
        ...createUserSlice(...a),
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
        }),
      },
    ),
  ),
)

export { useStore }
export type { UserState, UserSlice }
