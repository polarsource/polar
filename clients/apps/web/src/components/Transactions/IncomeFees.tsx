import {
  CondensedTableCell,
  CondensedTableExpanderCell,
  CondensedTableLine,
  type CondensedTableInstance,
} from '@/components/Shared/CondensedTable'
import { platformFeesDisplayNames } from '@/utils/transaction'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const format = formatCurrency('accounting')

const getFeeLabel = (fee: schemas['TransactionEmbedded']) =>
  fee.platform_fee_type
    ? platformFeesDisplayNames[fee.platform_fee_type]
    : 'Fee'

// What an income entry opens to: each fee taken from it, under the columns
// of the entry itself.
export const IncomeFees = ({
  table,
  transaction,
}: {
  table: CondensedTableInstance<schemas['Transaction']>
  transaction: schemas['Transaction']
}) => (
  <>
    {transaction.account_incurred_transactions.map((fee) => {
      const label = (
        <Text color="muted" truncate>
          {getFeeLabel(fee)}
        </Text>
      )
      const amount = (
        <Text color="muted" tabularNums wrap="nowrap">
          {format(fee.amount, fee.currency)}
        </Text>
      )
      return (
        <div key={fee.id}>
          <Box
            display={{ base: 'flex', md: 'none' }}
            alignItems="center"
            justifyContent="between"
            gap="m"
            paddingHorizontal="l"
            paddingVertical="xs"
          >
            {label}
            {amount}
          </Box>
          <CondensedTableLine inset="l" desktopOnly borderless>
            <CondensedTableExpanderCell />
            {table.getAllLeafColumns().map(({ id, columnDef: { meta } }) => (
              <CondensedTableCell key={id} column={meta}>
                {id === 'description' ? label : id === 'fees' ? amount : null}
              </CondensedTableCell>
            ))}
          </CondensedTableLine>
        </div>
      )
    })}
  </>
)
