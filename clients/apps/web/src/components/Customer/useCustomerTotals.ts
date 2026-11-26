import { useMetrics } from '@/hooks/queries/metrics'
import { schemas } from '@polar-sh/client'
import { differenceInDays } from 'date-fns'

// The longest range the metrics endpoint takes by month, less a day: it counts
// calendar days, and this counts whole ones.
const MAX_MONTHLY_DAYS = 365 * 4 - 1

// What a customer has brought in since they were first seen. Both are
// undefined until loaded.
export const useCustomerTotals = (
  organization: schemas['Organization'],
  customer: { id: string; created_at: string } | undefined,
  today: Date,
) => {
  const startDate = new Date(customer?.created_at ?? today)
  const { data: metrics } = useMetrics(
    {
      startDate,
      endDate: today,
      organization_id: organization.id,
      interval:
        differenceInDays(today, startDate) > MAX_MONTHLY_DAYS
          ? 'year'
          : 'month',
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
