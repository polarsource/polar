import { usePolarClient } from '@/providers/PolarClientProvider'
import { queryClient } from '@/utils/query'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'

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
    queryKey: ['organizations', { organizationId, ...(parameters || {}) }],
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
