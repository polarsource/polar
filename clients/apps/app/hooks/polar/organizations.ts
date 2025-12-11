import { usePolarClient } from '@/providers/PolarClientProvider'
import { useSession } from '@/providers/SessionProvider'
import { queryClient } from '@/utils/query'
import { operations, schemas, unwrap } from '@polar-sh/client'
import {
  useMutation,
  UseMutationResult,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

interface OrganizationDeletionResponse {
  deleted: boolean
  requires_support: boolean
  blocked_reasons: string[]
}

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
    queryFn: () =>
      unwrap(
        polar.GET('/v1/organizations/', {
          params: {
            query: {
              limit: 100,
            },
          },
        }),
      ),
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

export const useDeleteOrganization = (): UseMutationResult<
  { data?: OrganizationDeletionResponse; error?: { detail: string } },
  Error,
  string
> => {
  const { session } = useSession()

  return useMutation({
    mutationFn: async (organizationId: string) => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/organizations/${organizationId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session}`,
          },
        },
      )

      if (!response.ok) {
        const error = await response.json()
        return { error }
      }

      const data = await response.json()
      return { data }
    },
  })
}
