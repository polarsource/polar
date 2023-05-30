import { StateCreator } from 'zustand'
import { api } from '../api'
import {
  CancelablePromise,
  type IssueRead,
  type OrganizationPrivateRead,
  type OrganizationPublicRead,
  type PledgeRead,
  type RepositoryRead,
  type UserRead,
} from '../api/client'

export interface UserState {
  authenticated: boolean
  currentUser: UserRead | undefined
  login: (
    callback?: (authenticated: boolean) => void,
  ) => CancelablePromise<UserRead>
  logout: (
    callback?: (authenticated: boolean) => void,
  ) => CancelablePromise<any>
}

export interface OnboardingState {
  onboardingDashboardSkip: boolean
  setOnboardingDashboardSkip: (skip: boolean) => void

  onboardingDashboardInstallChromeExtensionSkip: boolean
  setOnboardingDashboardInstallChromeExtensionSkip: (skip: boolean) => void
}

export interface ContextState {
  userHaveOrgs: boolean
  currentOrg: OrganizationPrivateRead | undefined
  currentRepo: RepositoryRead | undefined
  setUserHaveOrgs: (userHaveOrgs: boolean) => void
  setCurrentOrgRepo: (
    org: OrganizationPrivateRead | undefined,
    repo: RepositoryRead | undefined,
  ) => void
}

export interface LastPledgeState {
  lastPledge:
    | {
        orgId: string
        orgName: string
        repoId: string
        repoName: string
        issueId: string
        issueNumber: number
        pledgeId: string
        pledgeAmount: number
        pledgeState: string
        redirectStatus: string
      }
    | undefined
  setLastPledge: (
    org: OrganizationPublicRead,
    repo: RepositoryRead,
    issue: IssueRead,
    pledge: PledgeRead,
    redirectStatus: string,
  ) => void
}

export interface UserContextState
  extends UserState,
    ContextState,
    OnboardingState,
    LastPledgeState {}

const emptyState = {
  authenticated: false,
  currentUser: undefined,
  onboardingDashboardSkip: false,
  onboardingDashboardInstallChromeExtensionSkip: false,
  userHaveOrgs: false,
  currentOrg: undefined,
  currentRepo: undefined,
  lastPledge: undefined,
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
      })
      .catch((err) => {
        set({ authenticated: false, currentUser: undefined })
      })
      .finally(() => {
        if (callback) {
          callback(get().authenticated)
        }
      })
    return request
  },
  logout: (): CancelablePromise<any> => {
    const request = api.users.logout()
    request.finally(() => {
      set({ ...emptyState })
    })
    return request
  },
  setUserHaveOrgs: (userHaveOrgs: boolean) => {
    set({ userHaveOrgs })
  },
  setCurrentOrgRepo: (
    org: OrganizationPrivateRead | undefined,
    repo: RepositoryRead | undefined,
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
  setLastPledge: (
    org: OrganizationPublicRead,
    repo: RepositoryRead,
    issue: IssueRead,
    pledge: PledgeRead,
    redirectStatus: string,
  ) => {
    set({
      lastPledge: {
        orgId: org.id,
        orgName: org.name,
        repoId: repo.id,
        repoName: repo.name,
        issueId: issue.id,
        issueNumber: issue.number,
        pledgeId: pledge.id,
        pledgeAmount: pledge.amount,
        pledgeState: pledge.state,
        redirectStatus: redirectStatus,
      },
    })
  },
})
