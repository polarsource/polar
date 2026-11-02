import { getServerURL } from '@/utils/api'
import { api } from '@/utils/client'
import { operations, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useCheckouts = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['checkouts:list']['parameters']['query']>,
    'organization_id'
  >,
) => {
  return useQuery({
    queryKey: ['checkouts', organizationId, { ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/checkouts/', {
          params: {
            query: { organization_id: organizationId, ...(parameters || {}) },
          },
        }),
      ),
    retry: defaultRetry,
  })
}

export const useTrackCheckoutOpened = (clientSecret: string) =>
  useMutation({
    mutationFn: (distinctId: string | undefined) =>
      fetch(getServerURL(`/v1/checkouts/client/${clientSecret}/opened`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distinct_id: distinctId }),
      }),
  })
