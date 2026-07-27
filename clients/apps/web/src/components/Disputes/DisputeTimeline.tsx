'use client'

import { getDisputeReasonExplanation } from '@/utils/dispute'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { BackgroundColorToken } from '@polar-sh/orbit/theme'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { differenceInCalendarDays } from 'date-fns'
import { useState } from 'react'

type StepState = 'complete' | 'current' | 'overdue' | 'upcoming'

interface TimelineStep {
  key: string
  title: string
  date?: string | null
  description?: string
  state: StepState
}

const DOT_COLOR: Record<StepState, BackgroundColorToken> = {
  complete: 'background-inverse',
  current: 'background-accent',
  overdue: 'background-danger',
  upcoming: 'background-primary',
}

const format = formatCurrency('accounting')

const EVENT_META: Partial<
  Record<
    schemas['SupportCaseMessageType'],
    { title: string; description: string }
  >
> = {
  dispute_under_review: {
    title: 'Under review by the bank',
    description: 'We submitted your evidence to the card network.',
  },
  merchant_accepted: {
    title: 'You accepted the dispute',
    description: 'You conceded and the customer was refunded.',
  },
  dispute_won: {
    title: 'Dispute won',
    description: 'The card network ruled in your favor.',
  },
  dispute_lost: {
    title: 'Dispute lost',
    description: 'The card network ruled in the customer’s favor.',
  },
  dispute_prevented: {
    title: 'Dispute prevented',
    description: 'Refunded before it escalated, avoiding any fees.',
  },
}

const dueDescription = (dispute: schemas['Dispute'], now: Date): string => {
  if (dispute.past_due) return 'Response overdue'
  if (!dispute.evidence_due_by) return 'Respond before the deadline'
  const days = differenceInCalendarDays(new Date(dispute.evidence_due_by), now)
  if (days <= 0) return 'Due today'
  if (days === 1) return '1 day left to respond'
  return `${days} days left to respond`
}

const buildSteps = (
  dispute: schemas['Dispute'],
  order: schemas['Order'] | undefined,
  messages: schemas['SupportCaseMessage'][],
  now: Date,
): TimelineStep[] => {
  const steps: TimelineStep[] = []

  if (order) {
    const buyer = order.customer.email ?? 'The customer'
    const productName = order.product?.name ?? 'a product'
    const price = format(order.total_amount, order.currency)
    steps.push({
      key: 'purchase',
      title: 'Purchase made',
      date: order.created_at,
      description: `${buyer} purchased ${productName} for ${price}`,
      state: 'complete',
    })
  }

  steps.push({
    key: 'disputed',
    title: 'Payment disputed',
    date: dispute.created_at,
    description: getDisputeReasonExplanation(dispute.reason),
    state: 'complete',
  })

  const sortedMessages = [...messages].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )

  for (const message of sortedMessages) {
    const meta = EVENT_META[message.type]
    if (!meta) continue
    steps.push({
      key: message.id,
      title: meta.title,
      date: message.created_at,
      description: meta.description,
      state: 'complete',
    })
  }

  const awaitingResponse =
    dispute.status === 'needs_response' || dispute.status === 'early_warning'

  if (awaitingResponse) {
    steps.push({
      key: 'respond',
      title: 'Respond with evidence',
      date: dispute.evidence_due_by,
      description: dueDescription(dispute, now),
      state: dispute.past_due ? 'overdue' : 'current',
    })
  }

  return steps
}

export const DisputeTimeline = ({
  dispute,
  order,
  messages,
}: {
  dispute: schemas['Dispute']
  order?: schemas['Order']
  messages: schemas['SupportCaseMessage'][]
}) => {
  const [now] = useState(() => new Date())
  const steps = buildSteps(dispute, order, messages, now).reverse()

  return (
    <Box flexDirection="column" rowGap="l">
      <Text variant="heading-xxs" as="h3">
        Timeline
      </Text>
      <Box flexDirection="column">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1
          return (
            <Box key={step.key} columnGap="m">
              <Box flexDirection="column" alignItems="center" rowGap="xs">
                <Box
                  width={12}
                  height={12}
                  marginTop="xs"
                  flexShrink={0}
                  borderRadius="full"
                  backgroundColor={DOT_COLOR[step.state]}
                  borderWidth={step.state === 'upcoming' ? 2 : 0}
                  borderStyle="solid"
                  borderColor="border-primary"
                />
                {!isLast && (
                  <Box
                    flexGrow={1}
                    borderLeftWidth={2}
                    borderStyle="solid"
                    borderColor="border-primary"
                  />
                )}
              </Box>
              <Box
                flexDirection="column"
                rowGap="xs"
                paddingBottom={isLast ? 'none' : 'xl'}
              >
                <Text
                  variant="title"
                  color={step.state === 'upcoming' ? 'muted' : 'default'}
                >
                  {step.title}
                </Text>
                {step.date && (
                  <Text variant="label" color="muted">
                    <FormattedDateTime
                      datetime={step.date}
                      resolution="time"
                      timeStyle="medium"
                    />
                  </Text>
                )}
                {step.description && (
                  <Text
                    variant="label"
                    color={step.state === 'overdue' ? 'danger' : 'muted'}
                  >
                    {step.description}
                  </Text>
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
