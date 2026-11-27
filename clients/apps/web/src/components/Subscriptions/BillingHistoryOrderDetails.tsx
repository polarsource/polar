'use client'

import {
  CondensedTableExpanderCell,
  CondensedTableLine,
} from '@/components/Shared/CondensedTable'
import { EntityLink } from '@/components/Shared/EntityLink'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { BillingHistoryAttempts } from './BillingHistoryAttempts'

// What an order in the billing history opens to: everything that happened on
// it, then the link to its page.
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
      <Box flexGrow={1} minWidth={0} alignItems="center">
        <EntityLink
          kind="order"
          href={`/dashboard/${organization.slug}/sales/${order.id}`}
          menuItems={[
            ...(order.invoice_number
              ? [{ label: 'Copy invoice number', copy: order.invoice_number }]
              : []),
            { label: 'Copy order ID', copy: order.id },
          ]}
        >
          {order.invoice_number ? `Invoice ${order.invoice_number}` : 'Order'}
        </EntityLink>
      </Box>
    </CondensedTableLine>
  </>
)
