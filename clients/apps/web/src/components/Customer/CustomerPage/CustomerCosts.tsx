'use client'

import CostsPage from '@/app/(main)/dashboard/[organization]/(header)/analytics/costs/CostsPage'
import { schemas } from '@polar-sh/client'
import { useCustomerMetricsParams } from './useCustomerMetricsParams'

interface CustomerCostsProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
}

export const CustomerCosts = ({
  organization,
  customer,
}: CustomerCostsProps) => {
  const { dateRange } = useCustomerMetricsParams(customer)

  return (
    <CostsPage
      organization={organization}
      customerId={customer.id}
      dateRange={dateRange}
      embedded
    />
  )
}
