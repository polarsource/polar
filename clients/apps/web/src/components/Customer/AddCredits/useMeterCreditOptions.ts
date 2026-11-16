import { useCustomerMeters } from '@/hooks/queries/customerMeters'
import { useMeters } from '@/hooks/queries/meters'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import { schemas } from '@polar-sh/client'
import { getMeterCreditOptions } from './creditPreview'

export const useMeterCreditOptions = (
  organizationId: string,
  customer: schemas['Customer'],
  meterId?: string,
) => {
  const { data: meters, isLoading: metersLoading } = useMeters(organizationId, {
    is_archived: false,
    sorting: ['name'],
    limit: 100,
  })
  const { data: customerMeters, isLoading: customerMetersLoading } =
    useCustomerMeters(organizationId, {
      customer_id: customer.id,
      limit: 100,
    })
  const { data: subscriptions, isLoading: subscriptionsLoading } =
    useSubscriptions(organizationId, {
      customer_id: customer.id,
      active: true,
      limit: 100,
    })

  return {
    options: getMeterCreditOptions(
      meters?.items ?? [],
      subscriptions?.items ?? [],
      customerMeters?.items ?? [],
      meterId,
    ),
    isLoading: metersLoading || customerMetersLoading || subscriptionsLoading,
  }
}
