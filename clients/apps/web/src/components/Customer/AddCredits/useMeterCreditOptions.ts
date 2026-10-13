import { useCustomerMeters } from '@/hooks/queries/customerMeters'
import { useMeters } from '@/hooks/queries/meters'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import { isMeteredPrice, MeteredPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { useMemo } from 'react'
import { MeterCreditOption } from './creditPreview'

export const useMeterCreditOptions = (
  organizationId: string,
  customer: schemas['Customer'],
): { options: MeterCreditOption[]; isLoading: boolean } => {
  const { data: meters, isLoading } = useMeters(organizationId, {
    is_archived: false,
    sorting: ['name'],
    limit: 100,
  })
  const { data: customerMeters } = useCustomerMeters(organizationId, {
    customer_id: customer.id,
    limit: 100,
  })
  const { data: subscriptions } = useSubscriptions(organizationId, {
    customer_id: customer.id,
    active: true,
  })

  const options = useMemo(
    () =>
      (meters?.items ?? []).map((meter): MeterCreditOption => {
        const subscription = subscriptions?.items.find((s) =>
          s.meters.some((m) => m.meter_id === meter.id),
        )
        return {
          meter,
          balance:
            customerMeters?.items.find((cm) => cm.meter_id === meter.id)
              ?.balance ?? 0,
          unitPrice:
            subscription?.product.prices.find(
              (p): p is MeteredPrice =>
                isMeteredPrice(p) && p.meter_id === meter.id,
            ) ?? null,
          productName: subscription?.product.name ?? null,
        }
      }),
    [meters, customerMeters, subscriptions],
  )

  return { options, isLoading }
}
