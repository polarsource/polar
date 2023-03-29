import { StateCreator } from 'zustand'
import { api } from '../api'
import {
  CancelablePromise,
  UserRead,
  type OrganizationRead,
  type RepositoryRead,
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

export interface ContextState {
  isOrganizationAccount: boolean
  currentOrg: OrganizationRead | undefined
  currentRepo: RepositoryRead | undefined
  setIsOrganizationAccount: (isOrganizationAccount: boolean) => void
  setCurrentOrg: (org: OrganizationRead) => void
  setCurrentRepo: (repo: RepositoryRead) => void
  setCurrentOrgRepo: (org: OrganizationRead, repo: RepositoryRead) => void
}

export interface UserContextState extends UserState, ContextState {}

const emptyState = {
  authenticated: false,
  currentUser: undefined,
  isOrganizationAccount: false,
  currentOrg: undefined,
  currentRepo: undefined,
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
  setIsOrganizationAccount: (isOrganizationAccount: boolean) => {
    set({ isOrganizationAccount })
  },
  setCurrentOrg: (org: OrganizationRead) => {
    set({ isOrganizationAccount: true, currentOrg: org })
  },
  setCurrentRepo: (repo: RepositoryRead) => {
    set({ isOrganizationAccount: true, currentRepo: repo })
  },
  setCurrentOrgRepo: (
    org: OrganizationRead,
    repo: RepositoryRead | undefined,
  ) => {
    set({ isOrganizationAccount: true, currentOrg: org, currentRepo: repo })
  },
})
