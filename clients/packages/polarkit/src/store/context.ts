import { StateCreator } from 'zustand'
import { OrganizationSchema, RepositorySchema } from '../api/client'

export interface ContextSlice {
  currentOrganization: OrganizationSchema | undefined
  currentRepository: RepositorySchema | undefined
  setCurrentOrganization: (organization: OrganizationSchema) => void
  setCurrentRepository: (repository: RepositorySchema) => void
  setCurrentOrganizationAndRepository: (
    organization: OrganizationSchema,
    repository: RepositorySchema,
  ) => void
}

export const createContextSlice: StateCreator<ContextSlice> = (set, get) => ({
  currentOrganization: undefined,
  currentRepository: undefined,
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
