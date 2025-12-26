import revalidate from '@/app/actions'
import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
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

export const useInviteOrganizationMember = (id: string) =>
  useMutation({
    mutationFn: (email: string) => {
      return api.POST('/v1/organizations/{id}/members/invite', {
        params: { path: { id } },
        body: { email },
      })
    },
    onSuccess: async (_result, _variables, _ctx) => {
      getQueryClient().invalidateQueries({
        queryKey: ['organizationMembers', id],
      })
    },
  })

export const useLeaveOrganization = (id: string) =>
  useMutation({
    mutationFn: () => {
      return api.DELETE('/v1/organizations/{id}/members/leave', {
        params: { path: { id } },
      })
    },
    onSuccess: async (_result, _variables, _ctx) => {
      getQueryClient().invalidateQueries({
        queryKey: ['organizations'],
      })
    },
  })

export const useRemoveOrganizationMember = (organizationId: string) =>
  useMutation({
    mutationFn: (userId: string) => {
      return api.DELETE('/v1/organizations/{id}/members/{user_id}', {
        params: { path: { id: organizationId, user_id: userId } },
      })
    },
    onSuccess: async (_result, _variables, _ctx) => {
      getQueryClient().invalidateQueries({
        queryKey: ['organizationMembers', organizationId],
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
    mutationFn: (body: schemas['OrganizationCreate']) => {
      return api.POST('/v1/organizations/', { body })
    },
    onSuccess: async (result, _variables, _ctx) => {
      const { data, error } = result
      if (error) {
        return
      }
      getQueryClient().invalidateQueries({
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
      body: schemas['OrganizationUpdate']
      userId?: string
    }) => {
      return api.PATCH('/v1/organizations/{id}', {
        params: { path: { id: variables.id } },
        body: variables.body,
      })
    },
    onSuccess: async (result, variables) => {
      const { data, error } = result
      if (error) {
        return
      }
      getQueryClient().invalidateQueries({
        queryKey: ['organizations', data.id],
      })
      await revalidate(`organizations:${data.id}`)
      await revalidate(`organizations:${data.slug}`)

      if (variables.userId) {
        await revalidate(`users:${variables.userId}:organizations`, {
          expire: 0,
        })
      }
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
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 403 || error?.response?.status === 404) {
        return false
      }
      return defaultRetry(failureCount, error)
    },
    enabled: !!id,
  })

export const useOrganizationAccessTokens = (
  organization_id: string,
  params?: Omit<
    NonNullable<
      operations['organization_access_token:list']['parameters']['query']
    >,
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: [
      'organization_access_tokens',
      { organization_id, ...(params || {}) },
    ],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organization-access-tokens/', {
          params: {
            query: {
              organization_id,
              ...(params || {}),
            },
          },
        }),
      ),
    retry: defaultRetry,
  })

export const useCreateOrganizationAccessToken = (organization_id: string) =>
  useMutation({
    mutationFn: (
      body: Omit<schemas['OrganizationAccessTokenCreate'], 'organization_id'>,
    ) => {
      return api.POST('/v1/organization-access-tokens/', {
        body: {
          ...body,
          organization_id,
        },
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      const { error } = result
      if (error) {
        return
      }
      getQueryClient().invalidateQueries({
        queryKey: ['organization_access_tokens', { organization_id }],
      })
    },
  })

export const useUpdateOrganizationAccessToken = (id: string) =>
  useMutation({
    mutationFn: (body: schemas['OrganizationAccessTokenUpdate']) => {
      return api.PATCH('/v1/organization-access-tokens/{id}', {
        params: { path: { id } },
        body,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      const { data, error } = result
      if (error) {
        return
      }
      getQueryClient().invalidateQueries({
        queryKey: [
          'organization_access_tokens',
          { organization_id: data.organization_id },
        ],
      })
    },
  })

export const useDeleteOrganizationAccessToken = () =>
  useMutation({
    mutationFn: (variables: schemas['OrganizationAccessToken']) => {
      return api.DELETE('/v1/organization-access-tokens/{id}', {
        params: { path: { id: variables.id } },
      })
    },
    onSuccess: (result, variables, _ctx) => {
      const { error } = result
      if (error) {
        return
      }
      getQueryClient().invalidateQueries({
        queryKey: [
          'organization_access_tokens',
          { organization_id: variables.organization_id },
        ],
      })
    },
  })

export const useOrganizationPaymentStatus = (
  id: string,
  enabled: boolean = true,
  accountVerificationOnly: boolean = false,
) =>
  useQuery({
    queryKey: ['organizations', 'payment-status', id, accountVerificationOnly],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/payment-status', {
          params: {
            path: { id },
            query: accountVerificationOnly
              ? { account_verification_only: true }
              : {},
          },
        }),
      ),
    retry: defaultRetry,
    enabled: enabled && !!id,
  })

export const useOrganizationAIValidation = (id: string) =>
  useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/organizations/{id}/ai-validation', {
          params: { path: { id } },
        }),
      ),
  })

export const useOrganizationAppeal = (id: string) =>
  useMutation({
    mutationFn: ({ reason }: { reason: string }) => {
      return api.POST('/v1/organizations/{id}/appeal', {
        params: { path: { id } },
        body: { reason },
      })
    },
    retry: defaultRetry,
  })

export const useOrganizationReviewStatus = (
  id: string,
  enabled: boolean = true,
  refetchInterval?: number,
) =>
  useQuery({
    queryKey: ['organizationReviewStatus', id],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/review-status', {
          params: { path: { id } },
        }),
      ),
    retry: defaultRetry,
    enabled: enabled && !!id,
    refetchInterval,
  })

export const useDeleteOrganization = () =>
  useMutation({
    mutationFn: (variables: { id: string }) => {
      return api.DELETE('/v1/organizations/{id}', {
        params: { path: { id: variables.id } },
      })
    },
    onSuccess: async (_result, _variables, _ctx) => {
      getQueryClient().invalidateQueries({
        queryKey: ['organizations'],
      })
    },
  })
