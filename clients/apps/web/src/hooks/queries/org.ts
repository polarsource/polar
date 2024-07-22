import { api, queryClient } from '@/utils/api'
import {
  ListResourceOrganization,
  Organization,
  OrganizationBadgeSettingsUpdate,
  OrganizationUpdate,
} from '@polar-sh/sdk'
import { UseMutationResult, useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useListMemberOrganizations = (enabled: boolean = true) =>
  useQuery({
    queryKey: ['user', 'organizations'],
    queryFn: () =>
      api.organizations.list({
        isMember: true,
      }),
    retry: defaultRetry,
    enabled,
  })

export const useListOrganizationMembers = (id?: string) =>
  useQuery({
    queryKey: ['organizationMembers', id],
    queryFn: () =>
      api.organizations.listMembers({
        id: id || '',
      }),
    retry: defaultRetry,
    enabled: !!id,
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

const updateOrgsCache = (result: Organization) => {
  queryClient.setQueriesData<ListResourceOrganization>(
    {
      queryKey: ['user', 'organizations'],
    },
    (data) => {
      if (!data) {
        return data
      }

      return {
        ...data,
        items: data.items?.map((i) => {
          if (i.id === result.id) {
            return {
              ...i,
              issue: result,
            }
          }
          return { ...i }
        }),
      }
    },
  )
}

export const useUpdateOrganization = () =>
  useMutation({
    mutationFn: (variables: { id: string; settings: OrganizationUpdate }) => {
      return api.organizations.update({
        id: variables.id,
        body: variables.settings,
      })
    },
    onSuccess: (result, variables, _ctx) => {
      updateOrgsCache(result)

      queryClient.invalidateQueries({
        queryKey: ['organizations', variables.id],
      })

      queryClient.invalidateQueries({
        queryKey: ['organization', 'slug', result.slug],
      })

      queryClient.invalidateQueries({
        queryKey: ['user', 'organizations'],
      })
    },
  })

export const useOrganizationBySlug = (
  slug: string | undefined,
  enabled: boolean = true,
) =>
  useQuery({
    queryKey: ['organization', 'slug', slug],
    queryFn: () =>
      api.organizations.list({ slug, limit: 1 }).then((r) => r.items?.[0]),
    retry: defaultRetry,
    enabled,
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
