import {
  CondensedTableCell,
  CondensedTableExpanderCell,
  CondensedTableLine,
} from '@/components/Shared/CondensedTable'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode } from 'react'
import { BillingHistoryDate } from './BillingHistoryDate'
import {
  AMOUNT_COLUMN,
  DATE_COLUMN,
  STATUS_COLUMN,
  TYPE_COLUMN,
} from './billingHistoryColumns'

// A line under an open order, on the table's own columns. The rule down the
// first column ties it to the order it belongs to.
export const BillingHistoryDetailRow = ({
  at,
  children,
  status,
  amount,
}: {
  at: string
  children: ReactNode
  status: ReactNode
  amount?: string
}) => (
  <Box as="li" display="block">
    <Box
      display={{ base: 'flex', md: 'none' }}
      flexDirection="column"
      rowGap="xs"
      paddingHorizontal="m"
      paddingVertical="xs"
    >
      <Box alignItems="center" justifyContent="between" gap="l">
        <BillingHistoryDate at={at} muted />
        <Text color="muted" tabularNums>
          {amount}
        </Text>
      </Box>
      <Box alignItems="center" justifyContent="between" gap="l">
        <Box alignItems="center" minWidth={0}>
          {children}
        </Box>
        <Box flexShrink={0}>{status}</Box>
      </Box>
    </Box>
    <CondensedTableLine inset="m" desktopOnly borderless>
      <CondensedTableExpanderCell>
        {/* Reaches over the line's padding, so the rule runs unbroken. */}
        <Box
          alignSelf="stretch"
          marginVertical="-s"
          borderLeftWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        />
      </CondensedTableExpanderCell>
      <CondensedTableCell column={DATE_COLUMN}>
        <BillingHistoryDate at={at} muted />
      </CondensedTableCell>
      <CondensedTableCell column={TYPE_COLUMN}>{children}</CondensedTableCell>
      <CondensedTableCell column={STATUS_COLUMN}>{status}</CondensedTableCell>
      <CondensedTableCell column={AMOUNT_COLUMN}>
        <Text color="muted" tabularNums align="right">
          {amount}
        </Text>
      </CondensedTableCell>
    </CondensedTableLine>
  </Box>
)
