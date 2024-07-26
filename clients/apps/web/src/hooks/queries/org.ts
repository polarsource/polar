import revalidate from '@/app/actions'
import { api, queryClient } from '@/utils/api'
import {
  Organization,
  OrganizationBadgeSettingsUpdate,
  OrganizationCreate,
  OrganizationUpdate,
  OrganizationsApiListRequest,
} from '@polar-sh/sdk'
import { UseMutationResult, useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useListOrganizationMembers = (id: string) =>
  useQuery({
    queryKey: ['organizationMembers', id],
    queryFn: () =>
      api.organizations.members({
        id,
      }),
    retry: defaultRetry,
  })

export const useOrganizationBadgeSettings = (id?: string) =>
  useQuery({
    queryKey: ['organizationBadgeSettings', id],
    queryFn: () => api.organizations.getBadgeSettings({ id: id ?? '' }),
    retry: defaultRetry,
    enabled: !!id,
  })

export const useUpdateOrganizationBadgeSettings: () => UseMutationResult<
  Organization,
  Error,
  {
    id: string
    settings: OrganizationBadgeSettingsUpdate
  },
  unknown
> = () =>
  useMutation({
    mutationFn: (variables: {
      id: string
      settings: OrganizationBadgeSettingsUpdate
    }) => {
      return api.organizations.updateBadgeSettings({
        id: variables.id,
        body: variables.settings,
      })
    },
    onSuccess: (_result, variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['organizationBadgeSettings', variables.id],
      })
    },
  })

export const useListOrganizations = (
  params: OrganizationsApiListRequest,
  enabled: boolean = true,
) =>
  useQuery({
    queryKey: ['organizations', params],
    queryFn: () => api.organizations.list(params),
    retry: defaultRetry,
    enabled,
  })

export const useCreateOrganization = () =>
  useMutation({
    mutationFn: (body: OrganizationCreate) => {
      return api.organizations.create({ body })
    },
    onSuccess: async (result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['organizations', result.id],
      })
      await revalidate(`organizations:${result.id}`)
      await revalidate(`organizations:${result.slug}`)
    },
  })

export const useUpdateOrganization = () =>
  useMutation({
    mutationFn: (variables: { id: string; body: OrganizationUpdate }) => {
      return api.organizations.update({
        id: variables.id,
        body: variables.body,
      })
    },
    onSuccess: async (result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['organizations', result.id],
      })
      await revalidate(`organizations:${result.id}`)
      await revalidate(`organizations:${result.slug}`)
    },
  })

export const useOrganization = (id: string, enabled: boolean = true) =>
  useQuery({
    queryKey: ['organization', id],
    queryFn: () => api.organizations.get({ id }),
    retry: defaultRetry,
    enabled,
  })

export const useOrganizationAccount = (id?: string) =>
  useQuery({
    queryKey: ['organization', 'account', id],
    queryFn: () => api.organizations.getAccount({ id: id as string }),
    retry: defaultRetry,
    enabled: !!id,
  })
