import { StateCreator } from 'zustand'
import { UserRead } from '../api/client'
import { api } from '../api'
import {
  OrganizationRead,
  RepositorySchema,
  CancelablePromise,
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
  currentOrg: OrganizationRead | undefined
  currentRepo: RepositorySchema | undefined
  setCurrentOrg: (org: OrganizationRead) => void
  setCurrentRepo: (repo: RepositorySchema) => void
  setCurrentOrgRepo: (org: OrganizationRead, repo: RepositorySchema) => void
}

export interface UserContextState extends UserState, ContextState {}

const emptyState = {
  authenticated: false,
  currentUser: undefined,
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
  setCurrentOrg: (org: OrganizationRead) => {
    set({ currentOrg: org })
  },
  setCurrentRepo: (repo: RepositorySchema) => {
    set({ currentRepo: repo })
  },
  setCurrentOrgRepo: (org: OrganizationRead, repo: RepositorySchema) => {
    set({ currentOrg: org, currentRepo: repo })
  },
})
