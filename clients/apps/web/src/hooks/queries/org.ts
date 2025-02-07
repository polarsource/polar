import revalidate from '@/app/actions'
import { queryClient } from '@/utils/api'
import { api } from '@/utils/client'
import { components, operations, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useListOrganizationMembers = (id: string) =>
  useQuery({
    queryKey: ['organizationMembers', id],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/members', { params: { path: { id } } }),
      ),
    retry: defaultRetry,
  })

export const useOrganizationBadgeSettings = (id?: string) =>
  useQuery({
    queryKey: ['organizationBadgeSettings', id],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/badge_settings', {
          params: { path: { id: id ?? '' } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!id,
  })

export const useUpdateOrganizationBadgeSettings = () =>
  useMutation({
    mutationFn: (variables: {
      id: string
      settings: components['schemas']['OrganizationBadgeSettingsUpdate']
    }) => {
      return api.POST('/v1/organizations/{id}/badge_settings', {
        params: { path: { id: variables.id } },
        body: variables.settings,
      })
    },
    onSuccess: (result, variables, _ctx) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['organizationBadgeSettings', variables.id],
      })
    },
  })

export const useListOrganizations = (
  params: operations['organizations:list']['parameters']['query'],
  enabled: boolean = true,
) =>
  useQuery({
    queryKey: ['organizations', params],
    queryFn: () =>
      unwrap(api.GET('/v1/organizations/', { param: { query: params } })),
    retry: defaultRetry,
    enabled,
  })

export const useCreateOrganization = () =>
  useMutation({
    mutationFn: (body: components['schemas']['OrganizationCreate']) => {
      return api.POST('/v1/organizations/', { body })
    },
    onSuccess: async (result, _variables, _ctx) => {
      const { data, error } = result
      if (error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['organizations', data.id],
      })
      await revalidate(`organizations:${data.id}`)
      await revalidate(`organizations:${data.slug}`)
      await revalidate(`storefront:${data.slug}`)
    },
  })

export const useUpdateOrganization = () =>
  useMutation({
    mutationFn: (variables: {
      id: string
      body: components['schemas']['OrganizationUpdate']
    }) => {
      return api.PATCH('/v1/organizations/{id}', {
        params: { path: { id: variables.id } },
        body: variables.body,
      })
    },
    onSuccess: async (result, _variables, _ctx) => {
      const { data, error } = result
      if (error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['organizations', data.id],
      })
      await revalidate(`organizations:${data.id}`)
      await revalidate(`organizations:${data.slug}`)
    },
  })

export const useOrganization = (id: string, enabled: boolean = true) =>
  useQuery({
    queryKey: ['organizations', id],
    queryFn: () =>
      unwrap(api.GET('/v1/organizations/{id}', { params: { path: { id } } })),
    retry: defaultRetry,
    enabled,
  })

export const useOrganizationAccount = (id?: string) =>
  useQuery({
    queryKey: ['organizations', 'account', id],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/account', {
          params: { path: { id: id ?? '' } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!id,
  })

export const useOrganizationAccessTokens = () =>
  useQuery({
    queryKey: ['organization_access_tokens'],
    queryFn: () => unwrap(api.GET('/v1/organization-access-tokens/')),
    retry: defaultRetry,
  })

export const useCreateOrganizationAccessToken = (id: string) =>
  useMutation({
    mutationFn: (
      body: Omit<
        components['schemas']['OrganizationAccessTokenCreate'],
        'organization_id'
      >,
    ) => {
      return api.POST('/v1/organization-access-tokens/', {
        body: {
          ...body,
          organization_id: id,
        },
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      const { error } = result
      if (error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['organization_access_tokens'],
      })
    },
  })

export const useUpdateOrganizationAccessToken = (id: string) =>
  useMutation({
    mutationFn: (
      body: components['schemas']['OrganizationAccessTokenUpdate'],
    ) => {
      return api.PATCH('/v1/organization-access-tokens/{id}', {
        params: { path: { id } },
        body,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      const { error } = result
      if (error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['organization_access_tokens'],
      })
    },
  })

export const useDeleteOrganizationAccessToken = () =>
  useMutation({
    mutationFn: (variables: { id: string }) => {
      return api.DELETE('/v1/organization-access-tokens/{id}', {
        params: { path: { id: variables.id } },
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      const { error } = result
      if (error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['organization_access_tokens'],
      })
    },
  })
