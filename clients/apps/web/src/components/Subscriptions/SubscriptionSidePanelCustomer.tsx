'use client'

import { Field } from '@/components/Events/EventDetailField'
import { EventTimestamp } from '@/components/Events/EventTimestamp'
import { CustomerEntityLink } from '@/components/Customer/CustomerEntityLink'
import { useMetrics } from '@/hooks/queries/metrics'
import { formatCountry } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export const SubscriptionSidePanelCustomer = ({
  organization,
  customer,
  today,
}: {
  organization: schemas['Organization']
  customer: schemas['Subscription']['customer']
  today: Date
}) => {
  const { data: metrics } = useMetrics({
    startDate: new Date(customer.created_at),
    endDate: today,
    organization_id: organization.id,
    interval: 'month',
    customer_id: [customer.id],
  })
  const revenue = metrics?.periods.at(-1)?.cumulative_revenue
  const orders = metrics?.periods.reduce(
    (total, period) => total + (period.orders ?? 0),
    0,
  )
  const country = customer.billing_address?.country
  const billingName =
    customer.billing_name && customer.billing_name !== customer.name
      ? customer.billing_name
      : null

  return (
    <>
      <Box
        paddingHorizontal="l"
        paddingVertical="m"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
      >
        <CustomerEntityLink organization={organization} customer={customer} />
      </Box>

      <Box flexDirection="column" paddingHorizontal="l" paddingBottom="m">
        <Field label="Revenue">
          <Text tabularNums>
            {revenue == null ? '—' : formatCurrency('compact')(revenue, 'usd')}
          </Text>
        </Field>
        <Field label="Orders">
          <Text tabularNums>{orders ?? '—'}</Text>
        </Field>
        <Field label="First seen">
          <EventTimestamp timestamp={customer.created_at} format="datetime" />
        </Field>
        {customer.type === 'team' && (
          <Field label="Type">
            <Text>Team</Text>
          </Field>
        )}
        {customer.email && (
          <Field label="Email" copyValue={customer.email}>
            <Text truncate>{customer.email}</Text>
          </Field>
        )}
        {billingName && (
          <Field label="Billed to" copyValue={billingName}>
            <Text truncate>{billingName}</Text>
          </Field>
        )}
        {country && (
          <Field label="Country">
            <Text truncate>{formatCountry(country)}</Text>
          </Field>
        )}
        {customer.tax_id && (
          <Field label="Tax ID" copyValue={customer.tax_id[0]}>
            <Text truncate>{customer.tax_id[0]}</Text>
          </Field>
        )}
        {customer.external_id && (
          <Field label="External ID" copyValue={customer.external_id}>
            <Text truncate monospace>
              {customer.external_id}
            </Text>
          </Field>
        )}
        <Field label="ID" copyValue={customer.id}>
          <Text truncate monospace>
            {customer.id}
          </Text>
        </Field>
      </Box>
    </>
  )
}
