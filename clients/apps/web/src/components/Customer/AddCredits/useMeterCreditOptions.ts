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

  const options = useMemo((): MeterCreditOption[] => {
    const balanceByMeter = new Map(
      customerMeters?.items.map((cm) => [cm.meter_id, cm.balance]),
    )
    return (meters?.items ?? []).map((meter) => {
      const subscription = subscriptions?.items.find((sub) =>
        sub.meters.some((m) => m.meter_id === meter.id),
      )
      const unitPrice = subscription?.prices.find(
        (price): price is MeteredPrice =>
          isMeteredPrice(price) && price.meter_id === meter.id,
      )
      return {
        meter,
        balance: balanceByMeter.get(meter.id) ?? 0,
        unitPrice: unitPrice ?? null,
        productName: subscription?.product.name ?? null,
      }
    })
  }, [meters, customerMeters, subscriptions])

  return {
    options,
    isLoading: metersLoading || customerMetersLoading || subscriptionsLoading,
  }
}
