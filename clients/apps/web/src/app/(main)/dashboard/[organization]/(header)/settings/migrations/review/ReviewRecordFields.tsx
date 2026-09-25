'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { buildCustomerDashboardPath } from '@/utils/customer'
import { Alert, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { ReactNode, useContext } from 'react'
import { ImportTaxPicker } from '../ImportTaxPicker'
import { migrationReasonNotice } from '../reasons'
import { BillingAddressEditor } from './BillingAddressEditor'
import { needsAttention, ReviewRow } from './reviewRows'

export function RecordCard({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <Box
      as="section"
      flexDirection="column"
      rowGap="l"
      padding="l"
      borderRadius="l"
      backgroundColor="background-card"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      minWidth={0}
    >
      <Box alignItems="center" justifyContent="between" columnGap="m">
        <Text variant="heading-xxs" as="h3">
          {title}
        </Text>
        {action}
      </Box>
      {children ? (
        <Box flexDirection="column" rowGap="m" minWidth={0}>
          {children}
        </Box>
      ) : null}
    </Box>
  )
}

export function RecordReason({ row }: { row: ReviewRow }) {
  const { organization } = useContext(OrganizationContext)
  if (!row.reason) return null

  const polarCustomerHref = row.conflicting_customer_id
    ? buildCustomerDashboardPath(organization.slug, {
        id: row.conflicting_customer_id,
      })
    : null
  const attention = needsAttention(row)
  const reason = migrationReasonNotice(row.reason_code) ?? row.reason

  return (
    // Alert grows to fill a column parent, so keep it in its own row.
    <Box>
      <Alert
        variant={attention ? 'warning' : 'info'}
        title={attention ? 'Needs your attention' : 'Good to know'}
        description={
          polarCustomerHref ? (
            <>
              {reason}{' '}
              <Link href={polarCustomerHref}>View Polar customer</Link>
            </>
          ) : (
            reason
          )
        }
      />
    </Box>
  )
}

export function BillingCountryField({
  row,
  migrationId,
}: {
  row: ReviewRow
  migrationId: string
}) {
  return (
    <DetailCell
      label="Billing country"
      value={
        row.entity === 'subscriptions' && row.record_id ? (
          <BillingAddressEditor
            key={row.record_id}
            migrationId={migrationId}
            row={row}
          />
        ) : (
          row.customer_country
        )
      }
    />
  )
}

export function TaxAfterSwitchField({
  row,
  migrationId,
}: {
  row: ReviewRow
  migrationId: string
}) {
  if (row.entity !== 'subscriptions') return null
  return (
    <ImportTaxPicker
      key={row.record_id ?? row.source_id}
      migrationId={migrationId}
      row={row}
    />
  )
}
