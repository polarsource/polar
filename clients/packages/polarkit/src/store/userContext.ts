import {
  Pledge,
  Repository,
  type Organization,
  type UserRead,
} from '@polar-sh/sdk'
import { StateCreator } from 'zustand'
import { api } from '../api'

export interface UserState {
  authenticated: boolean
  currentUser: UserRead | undefined
  login: (callback?: (authenticated: boolean) => void) => {
    request: Promise<UserRead>
    controller: AbortController
  }
  logout: () => Promise<any>
}

export interface OnboardingState {
  onboardingDashboardSkip: boolean
  setOnboardingDashboardSkip: (skip: boolean) => void

  onboardingDashboardInstallChromeExtensionSkip: boolean
  setOnboardingDashboardInstallChromeExtensionSkip: (skip: boolean) => void

  onboardingMaintainerConnectRepositoriesSkip: boolean
  setOnboardingMaintainerConnectRepositories: (skip: boolean) => void
}

export interface ContextState {
  userHaveOrgs: boolean
  currentOrg: Organization | undefined
  currentRepo: Repository | undefined
  setUserHaveOrgs: (userHaveOrgs: boolean) => void
  setCurrentOrgRepo: (
    org: Organization | undefined,
    repo: Repository | undefined,
  ) => void
}

export interface LastPledgeState {
  latestPledge:
    | {
        pledge: Pledge
        redirectStatus: string
      }
    | undefined
  latestPledgeShown: boolean
  setLatestPledge: (pledge: Pledge, redirectStatus: string) => void
  setLatestPledgeShown: (shown: boolean) => void
}

export interface UserContextState
  extends UserState,
    ContextState,
    OnboardingState,
    LastPledgeState {
  resetState: () => void
}

const emptyState = {
  authenticated: false,
  currentUser: undefined,
  onboardingDashboardSkip: false,
  onboardingDashboardInstallChromeExtensionSkip: false,
  onboardingMaintainerConnectRepositoriesSkip: false,
  userHaveOrgs: false,
  currentOrg: undefined,
  currentRepo: undefined,
  latestPledge: undefined,
  latestPledgeShown: false,
}

export const createUserContextSlice: StateCreator<UserContextState> = (
  set,
  get,
) => ({
  ...emptyState,
  login: (
    callback?: (authenticated: boolean) => void,
  ): { request: Promise<UserRead>; controller: AbortController } => {
    const controller = new AbortController()
    const request = api.users.getAuthenticated({ signal: controller.signal })
    request
      .then((user) => {
        set({ authenticated: true, currentUser: user })
        if (callback) {
          callback(true)
        }
      })
      .catch((err) => {
        if (err.status && err.status === 401) {
          set({ authenticated: false, currentUser: undefined })
          if (callback) {
            callback(false)
          }
        }
      })

    return { request, controller }
  },
  logout: (): Promise<any> => {
    const request = api.users.logout()
    request.finally(() => {
      get().resetState()
    })
    return request
  },
  setUserHaveOrgs: (userHaveOrgs: boolean) => {
    set({ userHaveOrgs })
  },
  setCurrentOrgRepo: (
    org: Organization | undefined,
    repo: Repository | undefined,
  ) => {
    set({
      currentOrg: org,
      currentRepo: repo,
    })
  },
  setOnboardingDashboardSkip: (skip: boolean) => {
    set({
      onboardingDashboardSkip: skip,
    })
  },
  setOnboardingDashboardInstallChromeExtensionSkip: (skip: boolean) => {
    set({
      onboardingDashboardInstallChromeExtensionSkip: skip,
    })
  },
  setOnboardingMaintainerConnectRepositories: (skip: boolean) => {
    set({
      onboardingMaintainerConnectRepositoriesSkip: skip,
    })
  },
  setLatestPledge: (pledge: Pledge, redirectStatus: string) => {
    set({
      latestPledge: {
        pledge: pledge,
        redirectStatus: redirectStatus,
      },
      latestPledgeShown: false,
    })
  },
  setLatestPledgeShown: (shown: boolean) => {
    set({
      latestPledgeShown: shown,
    })
  },
  resetState: () => {
    set({ ...emptyState })
  },
})
