import { api } from '@/utils/client'
import { operations, unwrap } from '@spaire/client'
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
