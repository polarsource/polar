'use client'

import {
  CondensedTableExpanderCell,
  CondensedTableLine,
} from '@/components/Shared/CondensedTable'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { BillingHistoryAttempts } from './BillingHistoryAttempts'

// What an order in the billing history opens to: everything that happened on
// it, then its invoice and the way to its page.
export const BillingHistoryOrderDetails = ({
  organization,
  order,
}: {
  organization: schemas['Organization']
  order: schemas['Order']
}) => (
  <>
    <BillingHistoryAttempts organizationId={organization.id} order={order} />
    <CondensedTableLine inset="m" desktopOnly={false} borderless>
      <CondensedTableExpanderCell />
      <Box
        flexGrow={1}
        minWidth={0}
        alignItems="center"
        justifyContent="between"
        columnGap="l"
      >
        <Text color="muted" truncate>
          {order.invoice_number ? `Invoice ${order.invoice_number}` : ''}
        </Text>
        <Link
          href={`/dashboard/${organization.slug}/sales/${order.id}`}
          className="shrink-0 hover:underline"
        >
          <Text wrap="nowrap">View order</Text>
        </Link>
      </Box>
    </CondensedTableLine>
  </>
)
