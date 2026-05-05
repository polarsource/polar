import { usePolarClient } from '@/providers/PolarClientProvider'
import { queryClient } from '@/utils/query'
import { operations, schemas, unwrap } from '@polar-sh/client'
import * as Sentry from '@sentry/react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useOrganizations = (
  {
    enabled = true,
  }: {
    enabled?: boolean
  } = { enabled: true },
) => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      try {
        return await unwrap(
          polar.GET('/v1/organizations/', {
            params: {
              query: {
                limit: 100,
              },
            },
          }),
        )
      } catch (error) {
        Sentry.captureException(error, {
          tags: { context: 'useOrganizations' },
        })
        throw error
      }
    },
    enabled,
  })
}

export const useOrganization = (
  organizationId?: string,
  parameters?: Omit<
    operations['organizations:list']['parameters']['query'],
    'organization_id'
  >,
) => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['organizations', organizationId, parameters],
    queryFn: () =>
      unwrap(
        polar.GET('/v1/organizations/', {
          param: {
            query: {
              organization_id: organizationId,
              ...(parameters || {}),
            },
          },
        }),
      ),
    enabled: !!organizationId,
  })
}

export const useCreateOrganization = () => {
  const { polar } = usePolarClient()

  return useMutation({
    mutationFn: (organization: schemas['OrganizationCreate']) =>
      unwrap(
        polar.POST('/v1/organizations/', {
          body: organization,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
  })
}

export const useUpdateOrganization = () => {
  const { polar } = usePolarClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      organizationId,
      update,
    }: {
      organizationId: string
      update: schemas['OrganizationUpdate']
    }) => {
      return unwrap(
        polar.PATCH('/v1/organizations/{id}', {
          params: { path: { id: organizationId } },
          body: update,
        }),
      )
    },
    onSettled: (data, error, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: ['organizations'],
      })
    },
  })
}

export const useDeleteOrganization = () => {
  const { polar } = usePolarClient()

  return useMutation({
    mutationFn: async (organizationId: string) => {
      const { data, error } = await polar.DELETE('/v1/organizations/{id}', {
        params: { path: { id: organizationId } },
      })
      return { data, error }
    },
  })
}
