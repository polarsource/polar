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

const BALANCE_POLL_INTERVAL_MS = 3_000
const BALANCE_POLL_TIMEOUT_MS = 60_000

const getCreditedUnits = async (customerId: string, meterId: string) => {
  try {
    const { data } = await api.GET('/v1/customer-meters/', {
      params: {
        query: { customer_id: customerId, meter_id: meterId, limit: 1 },
      },
    })
    return data?.items[0]?.credited_units
  } catch {
    return undefined
  }
}

const waitForCreditedUnitsChange = async (
  customerId: string,
  meterId: string,
  previousCreditedUnits: number | undefined,
) => {
  const deadline = Date.now() + BALANCE_POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise((resolve) =>
      setTimeout(resolve, BALANCE_POLL_INTERVAL_MS),
    )
    const creditedUnits = await getCreditedUnits(customerId, meterId)
    if (creditedUnits !== previousCreditedUnits) return
  }
}

export const useCreditCustomerMeter = () =>
  useMutation({
    onMutate: async ({
      customer_id,
      meter_id,
    }: schemas['CustomerMeterCreditsIDCreate']) => ({
      previousCreditedUnits: await getCreditedUnits(customer_id, meter_id),
    }),
    mutationFn: (body: schemas['CustomerMeterCreditsIDCreate']) =>
      api.POST('/v1/customer-meters/credits', { body }),
    onSuccess: (result, { customer_id, meter_id }, onMutateResult) => {
      if (result.error) return
      const queryClient = getQueryClient()
      queryClient.invalidateQueries({ queryKey: ['events'] })
      void waitForCreditedUnitsChange(
        customer_id,
        meter_id,
        onMutateResult?.previousCreditedUnits,
      ).finally(() =>
        queryClient.invalidateQueries({ queryKey: ['customer_meters'] }),
      )
    },
  })
