'use client'

import { DetailRow } from '@/components/Shared/DetailRow'
import { formatCountry } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'

interface CustomerDetailsSectionProps {
  customer: schemas['Customer']
}

export const CustomerDetailsSection = ({
  customer,
}: CustomerDetailsSectionProps) => (
  <ShadowBox className="flex flex-col gap-8">
    <Box flexDirection="column" rowGap="l">
      <Text variant="heading-xxs" as="h2">
        Customer Details
      </Text>
      <Box flexDirection="column" rowGap={{ base: 'm', md: 'none' }}>
        <DetailRow label="ID" value={customer.id} />
        <DetailRow label="External ID" value={customer.external_id} />
        <DetailRow label="Email" value={customer.email ?? '—'} />
        <DetailRow label="Name" value={customer.name} />
        <DetailRow
          label="Type"
          value={
            <Status
              color={customer.type === 'team' ? 'purple' : 'gray'}
              size="small"
              status={customer.type === 'team' ? 'Team' : 'Individual'}
            />
          }
        />
        <DetailRow
          label="Created At"
          value={<FormattedDateTime datetime={customer.created_at} />}
        />
      </Box>
    </Box>
    <Box flexDirection="column" rowGap="l">
      <Text variant="title" as="h4">
        Billing Information
      </Text>
      <Box flexDirection="column" rowGap={{ base: 'm', md: 'none' }}>
        <DetailRow label="Billing Name" value={customer.billing_name} />
        <DetailRow
          label="Tax ID"
          value={
            customer.tax_id ? (
              <Box as="span" alignItems="center" columnGap="xs">
                <span>{customer.tax_id[0]}</span>
                <Text as="span" variant="caption" color="muted" monospace>
                  {customer.tax_id[1].toLocaleUpperCase().replace('_', ' ')}
                </Text>
              </Box>
            ) : (
              '—'
            )
          }
        />
        <DetailRow label="Line 1" value={customer.billing_address?.line1} />
        <DetailRow label="Line 2" value={customer.billing_address?.line2} />
        <DetailRow label="City" value={customer.billing_address?.city} />
        <DetailRow label="State" value={customer.billing_address?.state} />
        <DetailRow
          label="Postal Code"
          value={customer.billing_address?.postal_code}
        />
        <DetailRow
          label="Country"
          value={
            customer.billing_address?.country
              ? formatCountry(customer.billing_address.country)
              : undefined
          }
        />
      </Box>
    </Box>
    {Object.keys(customer.metadata).length > 0 && (
      <Box flexDirection="column" rowGap="l">
        <Text variant="title" as="h3">
          Metadata
        </Text>
        <Box flexDirection="column" rowGap={{ base: 'm', md: 'none' }}>
          {Object.entries(customer.metadata).map(([key, value]) => (
            <DetailRow key={key} label={key} value={value} />
          ))}
        </Box>
      </Box>
    )}
  </ShadowBox>
)
