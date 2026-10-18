import { api } from '@/utils/client'
import { getQueryClient } from '@/utils/api/query'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useCustomerMeters = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['customer_meters:list']['parameters']['query']>,
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: ['customer_meters', { organizationId, parameters }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/customer-meters/', {
          params: {
            query: { organization_id: organizationId, ...(parameters || {}) },
          },
        }),
      ),
    retry: defaultRetry,
  })

export const useCreditCustomerMeter = () =>
  useMutation({
    mutationFn: (body: schemas['CustomerMeterCreditsIDCreate']) =>
      api.POST('/v1/customer-meters/credits', { body }),
    onSuccess: (result) => {
      if (result.error) return
      const queryClient = getQueryClient()
      queryClient.invalidateQueries({ queryKey: ['customer_meters'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })

export const useReverseMeterCredit = () =>
  useMutation({
    mutationFn: (id: string) =>
      api.POST('/v1/customer-meters/credits/{id}/reverse', {
        params: { path: { id } },
      }),
    onSuccess: (result) => {
      if (result.error) return
      const queryClient = getQueryClient()
      queryClient.invalidateQueries({ queryKey: ['customer_meters'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
