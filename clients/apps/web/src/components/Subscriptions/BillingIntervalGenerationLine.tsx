import {
  CondensedTableCell,
  CondensedTableExpanderCell,
  CondensedTableLine,
} from '@/components/Shared/CondensedTable'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  AMOUNT_COLUMN,
  GEN_COLUMN,
  PERIOD_COLUMN,
  PRICE_COLUMN,
  STATUS_COLUMN,
  USAGE_COLUMN,
  UsageStatus,
  UsageUnits,
  formatAmount,
} from './billingIntervalColumns'

export const BillingIntervalGenerationLine = ({
  organization,
  generation,
  currency,
}: {
  organization: schemas['Organization']
  generation: schemas['SubscriptionBillingIntervalGeneration']
  currency: string
}) => (
  <CondensedTableLine inset="m" desktopOnly={false} borderless>
    <CondensedTableExpanderCell>
      <Box
        alignSelf="stretch"
        marginVertical="-s"
        borderLeftWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      />
    </CondensedTableExpanderCell>
    <CondensedTableCell column={PERIOD_COLUMN} />
    <CondensedTableCell column={PRICE_COLUMN} />
    <CondensedTableCell column={USAGE_COLUMN}>
      <UsageUnits units={generation.units} />
    </CondensedTableCell>
    <CondensedTableCell column={AMOUNT_COLUMN}>
      <Text color="muted" tabularNums>
        {formatAmount(generation.amount, currency)}
      </Text>
    </CondensedTableCell>
    <CondensedTableCell column={STATUS_COLUMN}>
      <UsageStatus
        organization={organization}
        status={generation.status}
        orderId={generation.order_id}
      />
    </CondensedTableCell>
    <CondensedTableCell column={GEN_COLUMN}>
      <Text tabularNums>{generation.generation}</Text>
    </CondensedTableCell>
  </CondensedTableLine>
)
