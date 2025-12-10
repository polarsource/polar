import { useSession } from '@/providers/SessionProvider'
import { operations, schemas } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'

export const useSearch = (
  organizationId: string | undefined,
  parameters?: Omit<
    operations['search:search']['parameters']['query'],
    'organization_id'
  >,
) => {
  const { session } = useSession()

  return useQuery({
    queryKey: ['search', { organizationId, ...(parameters || {}) }],
    queryFn: async (): Promise<schemas['SearchResults']> => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/search`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session}`,
          },
        },
      )

      return response.json()
    },
  })
}
