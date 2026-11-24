'use client'

import PaymentMethod from '@/components/PaymentMethod/PaymentMethod'
import PaymentStatus from '@/components/PaymentStatus/PaymentStatus'
import { RefundReasonDisplay } from '@/components/Refunds/utils'
import { StatusLabel } from '@/components/Shared/StatusIcon'
import { useDisputes } from '@/hooks/queries/disputes'
import { usePayments } from '@/hooks/queries/payments'
import { useRefunds } from '@/hooks/queries/refunds'
import { DisputeStatusDisplayTitle } from '@/utils/dispute'
import { getPaymentDeclineMessage } from '@/utils/payment'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text, Truncated } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode } from 'react'
import { BillingHistoryDetailRow } from './BillingHistoryDetailRow'
import { DISPUTE_STATUS_ICONS, REFUND_STATUSES } from './billingHistoryStatuses'

const TRIGGER_LABELS: Record<schemas['PaymentTrigger'], string> = {
  purchase: 'Purchase',
  subscription_cycle: 'First attempt',
  retry_dunning: 'Automatic retry',
  retry_customer: 'Customer retry',
  retry_payment_method_update: 'New payment method',
  retry_admin: 'Manual retry',
  retry_payment_alert: 'Retry after alert',
}

const Name = ({ children }: { children: ReactNode }) => (
  <Box width={116} flexShrink={0}>
    <Text truncate>{children}</Text>
  </Box>
)

// Everything that happened on one order, newest first: the charges tried, the
// retry still to come, and any refund or dispute.
export const BillingHistoryAttempts = ({
  organizationId,
  order,
}: {
  organizationId: string
  order: schemas['Order']
}) => {
  const { data: payments, isLoading } = usePayments(organizationId, {
    order_id: order.id,
    sorting: ['-created_at'],
    limit: 100,
  })
  const { data: refunds } = useRefunds(
    order.refunded_amount > 0 ? order.id : undefined,
  )
  const { data: disputes } = useDisputes(organizationId, {
    order_id: order.id,
  })
  const format = formatCurrency('compact')
  const nextAttempt =
    order.status === 'pending' ? order.next_payment_attempt_at : null

  const rows = [
    ...(payments?.items ?? []).map((payment) => ({
      at: payment.created_at,
      row: (
        <BillingHistoryDetailRow
          key={payment.id}
          at={payment.created_at}
          status={<PaymentStatus payment={payment} />}
          amount={format(payment.amount, payment.currency)}
        >
          <Name>
            {payment.trigger ? TRIGGER_LABELS[payment.trigger] : 'Payment'}
          </Name>
          <Box width={104} flexShrink={0}>
            <PaymentMethod payment={payment} />
          </Box>
          <Truncated>
            <Text as="span" color="muted">
              {getPaymentDeclineMessage(payment)}
            </Text>
          </Truncated>
        </BillingHistoryDetailRow>
      ),
    })),
    ...(refunds?.items ?? []).map((refund) => ({
      at: refund.created_at,
      row: (
        <BillingHistoryDetailRow
          key={refund.id}
          at={refund.created_at}
          status={<StatusLabel {...REFUND_STATUSES[refund.status]} />}
          amount={`-${format(refund.amount, refund.currency)}`}
        >
          <Name>Refund</Name>
          <Truncated>
            <Text as="span" color="muted">
              {RefundReasonDisplay[refund.reason]}
            </Text>
          </Truncated>
        </BillingHistoryDetailRow>
      ),
    })),
    ...(disputes?.items ?? []).map((dispute) => ({
      at: dispute.created_at,
      row: (
        <BillingHistoryDetailRow
          key={dispute.id}
          at={dispute.created_at}
          status={
            <StatusLabel
              {...DISPUTE_STATUS_ICONS[dispute.status]}
              label={DisputeStatusDisplayTitle[dispute.status]}
            />
          }
          amount={format(dispute.amount, dispute.currency)}
        >
          <Name>Dispute</Name>
          <Truncated>
            <Text as="span" color="muted">
              {dispute.reason}
            </Text>
          </Truncated>
        </BillingHistoryDetailRow>
      ),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  if (rows.length === 0 && !nextAttempt) {
    return (
      <Box paddingHorizontal="m" paddingVertical="s">
        <Text color="muted">
          {isLoading ? 'Loading payment attempts' : 'No payment attempts'}
        </Text>
      </Box>
    )
  }
  return (
    <Box as="ul" flexDirection="column">
      {nextAttempt && (
        <BillingHistoryDetailRow
          at={nextAttempt}
          status={<StatusLabel shape="dashed" label="Scheduled" />}
        >
          <Text color="muted" truncate>
            Automatic retry
          </Text>
        </BillingHistoryDetailRow>
      )}
      {rows.map(({ row }) => row)}
    </Box>
  )
}
