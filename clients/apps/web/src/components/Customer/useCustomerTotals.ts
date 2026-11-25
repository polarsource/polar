import { useMetrics } from '@/hooks/queries/metrics'
import { schemas } from '@polar-sh/client'

// What a customer has brought in since they were first seen. Both are
// undefined until loaded.
export const useCustomerTotals = (
  organization: schemas['Organization'],
  customer: { id: string; created_at: string } | undefined,
  today: Date,
) => {
  const { data: metrics } = useMetrics(
    {
      startDate: new Date(customer?.created_at ?? today),
      endDate: today,
      organization_id: organization.id,
      interval: 'month',
      customer_id: customer ? [customer.id] : undefined,
    },
    customer !== undefined,
  )
  return {
    revenue: metrics?.periods.at(-1)?.cumulative_revenue,
    orders: metrics?.periods.reduce(
      (total, period) => total + (period.orders ?? 0),
      0,
    ),
  }
}
