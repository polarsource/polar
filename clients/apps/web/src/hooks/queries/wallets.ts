import { api } from '@/utils/client'
import { operations, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useWallets = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['wallets:list']['parameters']['query']>,
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: ['wallets', { organizationId, parameters }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/wallets/', {
          params: {
            query: { organization_id: organizationId, ...(parameters || {}) },
          },
        }),
      ),
    retry: defaultRetry,
  })
