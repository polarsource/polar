'use client'

import { ClickToCopy, copyable } from '@/components/Shared/ClickToCopy'
import { useWallets } from '@/hooks/queries'
import { formatCountry } from '@/utils/formatters'
import { formatCurrency } from '@polar-sh/currency'
import { schemas } from '@polar-sh/client'
import { Grid, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { PropsWithChildren, ReactNode } from 'react'

interface CustomerDetailsSectionProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
}

const Section = ({ title, children }: PropsWithChildren<{ title: string }>) => (
  <Box as="section" flexDirection="column" rowGap="s">
    <Text as="h3">{title}</Text>
    <Box flexDirection="column">{children}</Box>
  </Box>
)

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <Box
    alignItems="baseline"
    justifyContent="between"
    columnGap="m"
    paddingVertical="s"
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-secondary"
  >
    <Box flexShrink={0}>
      <Text color="muted">{label}</Text>
    </Box>
    <Box minWidth={0} justifyContent="end" textAlign="right">
      {value ? (
        <Text as="div" truncate>
          {value}
        </Text>
      ) : (
        <Text color="muted">—</Text>
      )}
    </Box>
  </Box>
)

const formatAddress = (address: schemas['Customer']['billing_address']) => {
  const lines = [
    address?.line1,
    address?.line2,
    [address?.postal_code, address?.city].filter(Boolean).join(' '),
    address?.state,
  ].filter((line): line is string => !!line)
  return lines.length > 0 ? lines.join(', ') : null
}

// Titled sections of hairline label/value rows, side by side from md, with long values
// truncated (copying still takes the full value).
export const CustomerDetailsSection = ({
  organization,
  customer,
}: CustomerDetailsSectionProps) => {
  const address = formatAddress(customer.billing_address)
  const { data: billingWallets } = useWallets(organization.id, {
    customer_id: customer.id,
    type: 'billing',
  })
  const balance =
    billingWallets && billingWallets.items.length > 0
      ? billingWallets.items
          .map((wallet) =>
            formatCurrency('statistics')(wallet.balance, wallet.currency),
          )
          .join(', ')
      : null

  return (
    <Grid
      templateColumns={{
        base: 'minmax(0, 1fr)',
        md: 'repeat(2, minmax(0, 1fr))',
      }}
      columnGap="3xl"
      rowGap="2xl"
      alignItems="start"
    >
      <Section title="Details">
        <Row label="ID" value={copyable(customer.id)} />
        <Row label="External ID" value={copyable(customer.external_id)} />
        <Row label="Email" value={copyable(customer.email)} />
        <Row label="Name" value={copyable(customer.name)} />
        <Row
          label="Type"
          value={
            <Status
              color={customer.type === 'team' ? 'purple' : 'gray'}
              size="small"
              status={customer.type === 'team' ? 'Team' : 'Individual'}
            />
          }
        />
        <Row
          label="Created"
          value={<FormattedDateTime datetime={customer.created_at} />}
        />
      </Section>
      <Section title="Billing">
        <Row label="Balance" value={balance} />
        <Row label="Name" value={copyable(customer.billing_name)} />
        <Row
          label="Tax ID"
          value={
            customer.tax_id ? (
              <Box as="span" alignItems="center" columnGap="xs">
                <ClickToCopy>{customer.tax_id[0]}</ClickToCopy>
                <Text as="span" variant="caption" color="muted">
                  {customer.tax_id[1].toLocaleUpperCase().replace('_', ' ')}
                </Text>
              </Box>
            ) : null
          }
        />
        {address && <Row label="Address" value={copyable(address)} />}
        <Row
          label="Country"
          value={
            customer.billing_address?.country
              ? copyable(formatCountry(customer.billing_address.country))
              : null
          }
        />
      </Section>
      {Object.keys(customer.metadata).length > 0 && (
        <Section title="Metadata">
          {Object.entries(customer.metadata).map(([key, value]) => (
            <Row key={key} label={key} value={copyable(String(value))} />
          ))}
        </Section>
      )}
    </Grid>
  )
}
