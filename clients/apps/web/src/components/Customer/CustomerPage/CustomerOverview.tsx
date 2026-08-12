'use client'

import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { CustomerBenefitGrantsTable } from './CustomerBenefitGrantsTable'
import { CustomerDetailsSection } from './CustomerDetailsSection'
import { CustomerMetricsOverview } from './CustomerMetricsOverview'
import { CustomerOrdersTable } from './CustomerOrdersTable'
import { CustomerPaymentsTable } from './CustomerPaymentsTable'
import { CustomerSubscriptionsTable } from './CustomerSubscriptionsTable'
import { useCustomerMetricsParams } from './useCustomerMetricsParams'

interface CustomerOverviewProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
}

export const CustomerOverview = ({
  organization,
  customer,
}: CustomerOverviewProps) => {
  const { dateRange, interval } = useCustomerMetricsParams(customer)

  return (
    <Box flexDirection="column" rowGap="2xl">
      <CustomerMetricsOverview
        organization={organization}
        customer={customer}
        dateRange={dateRange}
        interval={interval}
      />
      <CustomerSubscriptionsTable
        organization={organization}
        customer={customer}
      />
      <CustomerOrdersTable organization={organization} customer={customer} />
      <CustomerPaymentsTable organization={organization} customer={customer} />
      <CustomerBenefitGrantsTable
        organization={organization}
        customer={customer}
      />
      <CustomerDetailsSection customer={customer} />
    </Box>
  )
}
