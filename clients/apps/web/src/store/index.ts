import { CONFIG } from '@/utils/config'
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { FormDraftSlice, createFormDraftSlice } from './formDraftSlice'
import {
  GitHubInstallationSlice,
  createGitHubInstallationSlice,
} from './githubInstallation'
import { UserSlice, createUserSlice } from './userContext'

// https://docs.pmnd.rs/zustand/guides/typescript#slices-pattern
const useStore = create<UserSlice & FormDraftSlice & GitHubInstallationSlice>()(
  devtools(
    persist(
      (...a) => ({
        ...createUserSlice(...a),
        ...createFormDraftSlice(...a),
        ...createGitHubInstallationSlice(...a),
      }),
      {
        name: CONFIG.LOCALSTORAGE_PERSIST_KEY,
        version: CONFIG.LOCALSTORAGE_PERSIST_VERSION,
        partialize: (state) => ({
          // From UserSlice
          onboardingDashboardSkip: state.onboardingDashboardSkip,
          onboardingDashboardInstallChromeExtensionSkip:
            state.onboardingDashboardInstallChromeExtensionSkip,
          onboardingMaintainerConnectRepositoriesSkip:
            state.onboardingMaintainerConnectRepositoriesSkip,
          formDrafts: state.formDrafts,
          gitHubInstallation: state.gitHubInstallation,
        }),
      },
    ),
  ),
)

export { useStore }
export type { UserSlice }
