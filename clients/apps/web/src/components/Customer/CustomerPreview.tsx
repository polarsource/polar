'use client'

import {
  EntityPreview,
  EntityPreviewRow,
  EntityPreviewSection,
  EntityPreviewSkeletonBar,
  EntityPreviewTitle,
} from '@/components/Shared/EntityPreview'
import { useCustomer } from '@/hooks/queries/customers'
import { formatCountry } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { format } from 'date-fns'
import { useState } from 'react'
import { getCustomerLabel } from './CustomerEntityLink'
import { useCustomerTotals } from './useCustomerTotals'

const isSameName = (a: string | null, b: string | null) =>
  a?.toLocaleLowerCase() === b?.toLocaleLowerCase()

// What a customer link shows while it is pointed at: who they are, what they
// have brought in, and who is billed. Loaded when the card opens.
export const CustomerPreview = ({
  organization,
  customerId,
}: {
  organization: schemas['Organization']
  customerId: string
}) => {
  const { data: customer, isError } = useCustomer(customerId)
  const [today] = useState(() => new Date())
  const {
    isLoading: isLoadingTotals,
    revenue,
    orders,
  } = useCustomerTotals(organization, customer, today)
  const country = customer?.billing_address?.country
  return (
    <EntityPreview isLoading={!customer} isError={isError}>
      {customer && (
        <>
          <EntityPreviewSection>
            <EntityPreviewTitle title={getCustomerLabel(customer)} />
            {customer.name && customer.email && (
              <Text color="muted" truncate>
                {customer.email}
              </Text>
            )}
          </EntityPreviewSection>
          <EntityPreviewSection divided>
            <EntityPreviewRow label="Revenue">
              {isLoadingTotals ? (
                <EntityPreviewSkeletonBar width={56} />
              ) : revenue == null ? (
                '—'
              ) : (
                formatCurrency('compact')(revenue, 'usd')
              )}
            </EntityPreviewRow>
            <EntityPreviewRow label="Orders">
              {isLoadingTotals ? (
                <EntityPreviewSkeletonBar width={24} />
              ) : (
                (orders ?? '—')
              )}
            </EntityPreviewRow>
            <EntityPreviewRow label="First seen">
              {format(new Date(customer.created_at), 'MMM d, yyyy')}
            </EntityPreviewRow>
            {customer.type === 'team' && (
              <EntityPreviewRow label="Type">Team</EntityPreviewRow>
            )}
            {customer.billing_name &&
              !isSameName(customer.billing_name, customer.name) && (
                <EntityPreviewRow label="Billed to">
                  {customer.billing_name}
                </EntityPreviewRow>
              )}
            {country && (
              <EntityPreviewRow label="Country">
                {formatCountry(country)}
              </EntityPreviewRow>
            )}
            {customer.tax_id && (
              <EntityPreviewRow label="Tax ID">
                {customer.tax_id[0]}
              </EntityPreviewRow>
            )}
            {customer.external_id && (
              <EntityPreviewRow label="External ID">
                {customer.external_id}
              </EntityPreviewRow>
            )}
          </EntityPreviewSection>
        </>
      )}
    </EntityPreview>
  )
}
