import { StateCreator } from 'zustand'
import { api } from '../api'
import {
  CancelablePromise,
  Issue,
  Repository,
  type Organization,
  type PledgeRead,
  type UserRead,
} from '../api/client'

export interface UserState {
  authenticated: boolean
  currentUser: UserRead | undefined
  login: (
    callback?: (authenticated: boolean) => void,
  ) => CancelablePromise<UserRead>
  logout: () => CancelablePromise<any>
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
        orgId: string
        orgName: string
        repoId: string
        repoName: string
        issueId: string
        issueNumber: number
        pledge: PledgeRead
        redirectStatus: string
      }
    | undefined
  latestPledgeShown: boolean
  setLatestPledge: (
    org: Organization,
    repo: Repository,
    issue: Issue,
    pledge: PledgeRead,
    redirectStatus: string,
  ) => void
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
  ): CancelablePromise<UserRead> => {
    const request = api.users.getAuthenticated()
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
    return request
  },
  logout: (): CancelablePromise<any> => {
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
  setLatestPledge: (
    org: Organization,
    repo: Repository,
    issue: Issue,
    pledge: PledgeRead,
    redirectStatus: string,
  ) => {
    set({
      latestPledge: {
        orgId: org.id,
        orgName: org.name,
        repoId: repo.id,
        repoName: repo.name,
        issueId: issue.id,
        issueNumber: issue.number,
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
