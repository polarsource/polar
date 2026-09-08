'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import { Alert, InlineModalHeader, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { MockSubscriptionRecord } from './mockData'
import {
  CATEGORY_LABELS,
  OWNER_LABELS,
  STATUS_LABELS,
  statusColor,
} from './recordLabels'
import { resolveBillingOwner } from './selectors'

export function CurrentRecordModal({
  record,
  onClose,
  transferred = false,
}: {
  record: MockSubscriptionRecord
  onClose: () => void
  transferred?: boolean
}) {
  const owner = resolveBillingOwner(record, transferred)
  const problem = record.category !== 'clean'

  return (
    <Box flexDirection="column" height="100%">
      <InlineModalHeader hide={onClose}>
        <Text variant="heading-xs" as="h2">
          {record.customerEmail || record.customerLabel}
        </Text>
      </InlineModalHeader>

      <Box
        flexDirection="column"
        rowGap="xl"
        padding="xl"
        flex={1}
        overflowY="auto"
      >
        {problem ? (
          <Box>
            <Alert
              variant="warning"
              title={record.title}
              description={record.detail}
            />
          </Box>
        ) : null}

        <Box flexDirection="column" rowGap="l" minWidth={0}>
          <Text variant="body" as="h3">
            Subscription
          </Text>
          <Box flexDirection="column" rowGap="m" minWidth={0}>
            <DetailCell label="Customer" value={record.customerLabel} />
            <DetailCell
              label="Email"
              value={record.customerEmail ?? 'No email'}
            />
            <DetailCell label="Product" value={record.productName} />
            <DetailCell label="Plan" value={record.planLabel} />
            <DetailCell
              label="Import"
              value={
                <Status
                  status={problem ? CATEGORY_LABELS[record.category] : 'Ready'}
                  color="gray"
                  size="small"
                />
              }
            />
            <DetailCell
              label="Status"
              value={
                <Status
                  status={STATUS_LABELS[record.status]}
                  color={statusColor(record.status)}
                  size="small"
                />
              }
            />
            <DetailCell
              label="Billing"
              value={
                <Status
                  status={OWNER_LABELS[owner]}
                  color={owner === 'polar' ? 'green' : 'gray'}
                  size="small"
                />
              }
            />
            <DetailCell
              label="Recommended action"
              value={record.recommendedAction}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
