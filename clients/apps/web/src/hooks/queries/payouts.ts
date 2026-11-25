import { api } from '@/utils/client'
import { operations, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const usePayouts = (
  accountId?: string,
  parameters?: Omit<
    NonNullable<operations['payouts:list']['parameters']['query']>,
    'account_id'
  >,
) =>
  useQuery({
    queryKey: ['payouts', { accountId, ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/payouts/', {
          params: {
            query: {
              account_id: accountId,
              ...parameters,
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!accountId,
  })

export const usePayoutEstimate = (
  organizationId: string,
  { enabled = true }: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: ['payouts', 'estimate', { organizationId }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/payouts/estimate', {
          params: { query: { organization_id: organizationId } },
        }),
      ),
    retry: false,
    enabled,
  })
