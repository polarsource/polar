import { StateCreator } from 'zustand'
import { UserRead } from '../api/client'
import { api } from '../api'
import {
  OrganizationSchema,
  RepositorySchema,
  CancelablePromise,
} from '../api/client'

export interface UserState {
  authenticated: boolean
  user: UserRead | null
  login: (
    callback?: (authenticated: boolean) => void,
  ) => CancelablePromise<UserRead>
  logout: (
    callback?: (authenticated: boolean) => void,
  ) => CancelablePromise<any>
}

export interface ContextState {
  currentOrganization: OrganizationSchema | undefined
  currentRepository: RepositorySchema | undefined
  setCurrentOrganization: (organization: OrganizationSchema) => void
  setCurrentRepository: (repository: RepositorySchema) => void
  setCurrentOrganizationAndRepository: (
    organization: OrganizationSchema,
    repository: RepositorySchema,
  ) => void
}

export interface UserContextState extends UserState, ContextState {}

export const createUserContextSlice: StateCreator<UserContextState> = (
  set,
  get,
) => ({
  authenticated: false,
  user: null,
  currentOrganization: undefined,
  currentRepository: undefined,
  login: (
    callback?: (authenticated: boolean) => void,
  ): CancelablePromise<UserRead> => {
    const request = api.users.getAuthenticated()
    request
      .then((user) => {
        set({ authenticated: true, user })
      })
      .catch((err) => {
        set({ authenticated: false, user: null })
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
      set({ authenticated: false, user: null })
    })
    return request
  },
  setCurrentOrganization: (organization: OrganizationSchema) => {
    set({ currentOrganization: organization })
  },
  setCurrentRepository: (repository: RepositorySchema) => {
    set({ currentRepository: repository })
  },
  setCurrentOrganizationAndRepository: (
    organization: OrganizationSchema,
    repository: RepositorySchema,
  ) => {
    set({ currentOrganization: organization, currentRepository: repository })
  },
})
