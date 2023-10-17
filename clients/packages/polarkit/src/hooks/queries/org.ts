import {
  ListResourceOrganization,
  Organization,
  OrganizationBadgeSettingsUpdate,
  OrganizationUpdate,
} from '@polar-sh/sdk'
import {
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { api, queryClient } from '../../api'
import { defaultRetry } from './retry'

export const useListAdminOrganizations: () => UseQueryResult<ListResourceOrganization> =
  () =>
    useQuery({
      queryKey: ['user', 'adminOrganizations'],
      queryFn: () =>
        api.organizations.list({
          isAdminOnly: true,
        }),
      retry: defaultRetry,
    })

export const useListAllOrganizations: () => UseQueryResult<ListResourceOrganization> =
  () =>
    useQuery({
      queryKey: ['user', 'allOrganizations'],
      queryFn: () =>
        api.organizations.list({
          isAdminOnly: false,
        }),
      retry: defaultRetry,
    })

export const useOrganizationBadgeSettings = (id: string) =>
  useQuery({
    queryKey: ['organizationBadgeSettings', id],
    queryFn: () => api.organizations.getBadgeSettings({ id }),
    retry: defaultRetry,
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
        organizationBadgeSettingsUpdate: variables.settings,
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['organizationBadgeSettings', variables.id],
      })
    },
  })

const updateOrgsCache = (result: Organization) => {
  queryClient.setQueriesData<ListResourceOrganization>(
    {
      queryKey: ['user', 'adminOrganizations'],
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

  queryClient.setQueriesData<ListResourceOrganization>(
    {
      queryKey: ['user', 'allOrganizations'],
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
        organizationUpdate: variables.settings,
      })
    },
    onSuccess: (result, variables, ctx) => {
      updateOrgsCache(result)
    },
  })
