'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { DisputeEvidenceForm } from '@/components/Disputes/DisputeEvidenceForm'
import { getMockDispute } from '@/components/Disputes/mockDisputes'
import {
  DisputeStatusDisplayColor,
  DisputeStatusDisplayTitle,
  getDisputeReasonDescription,
} from '@/utils/dispute'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Button, Status, Text, Truncated } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React, { useState } from 'react'

interface Props {
  organization: schemas['Organization']
  disputeId: string
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })

const SummaryItem = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <Box flexDirection="column" rowGap="xs" minWidth={0}>
    <Text variant="caption" color="muted">
      {label}
    </Text>
    {children}
  </Box>
)

const DisputeDetailPage: React.FC<Props> = ({ organization, disputeId }) => {
  const dispute = getMockDispute(disputeId)
  const [submittedStatus, setSubmittedStatus] = useState<
    schemas['DisputeStatus'] | null
  >(null)

  if (!dispute) {
    notFound()
  }

  const needsResponse = dispute.status === 'needs_response'
  const displayStatus = submittedStatus ?? dispute.status

  return (
    <DashboardBody>
      <Box flexDirection="column" rowGap="xl">
        <Box
          flexDirection="column"
          rowGap="l"
          borderRadius="l"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          backgroundColor="background-primary"
          padding="xl"
        >
          <Box alignItems="center" justifyContent="between" columnGap="m">
            <Box flexDirection="column" rowGap="xs">
              <Text variant="heading-xs" as="h2">
                {formatCurrency('standard')(dispute.amount, dispute.currency)}{' '}
                dispute
              </Text>
              <Text color="muted">
                Opened {formatDate(dispute.created_at)} · {dispute.product_name}
              </Text>
            </Box>
            <Box alignItems="center" columnGap="m">
              <Status
                status={DisputeStatusDisplayTitle[displayStatus]}
                color={DisputeStatusDisplayColor[displayStatus]}
              />
              <Link
                href={`/dashboard/${organization.slug}/sales/${dispute.order_id}`}
              >
                <Button variant="secondary" size="sm">
                  Go to order
                </Button>
              </Link>
            </Box>
          </Box>

          <Box
            display="grid"
            gridTemplateColumns={{ base: '1fr 1fr', md: 'repeat(4, 1fr)' }}
            gap="l"
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            paddingTop="l"
          >
            <SummaryItem label="Customer">
              <Text variant="label">{dispute.customer_email}</Text>
            </SummaryItem>
            <SummaryItem label="Reason">
              <Text variant="label">
                {getDisputeReasonDescription(dispute.reason)}
              </Text>
            </SummaryItem>
            <SummaryItem label="Order">
              <Truncated>
                <Text variant="label">{dispute.order_id}</Text>
              </Truncated>
            </SummaryItem>
            <SummaryItem label="Respond by">
              {dispute.evidence_due_by ? (
                <Text
                  variant="label"
                  color={dispute.past_due ? 'danger' : 'default'}
                >
                  {dispute.past_due
                    ? 'Overdue'
                    : formatDate(dispute.evidence_due_by)}
                </Text>
              ) : (
                <Text variant="label" color="muted">
                  —
                </Text>
              )}
            </SummaryItem>
          </Box>
        </Box>

        {needsResponse ? (
          <DisputeEvidenceForm
            onSubmitted={(decision) =>
              setSubmittedStatus(decision === 'counter' ? 'under_review' : 'lost')
            }
          />
        ) : (
          <Box
            flexDirection="column"
            rowGap="s"
            borderRadius="l"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            backgroundColor="background-secondary"
            padding="xl"
          >
            <Text variant="label">No action needed</Text>
            <Text color="muted">
              {dispute.status === 'under_review' &&
                'Your evidence was submitted. The bank is reviewing the dispute and will decide the outcome.'}
              {dispute.status === 'won' &&
                'This dispute was resolved in your favor — the funds were returned to your balance.'}
              {dispute.status === 'lost' &&
                "This dispute was resolved in the customer's favor — the amount and any fees were deducted from your balance."}
              {dispute.status === 'prevented' &&
                'This payment was refunded before the dispute escalated, so no dispute fees applied.'}
              {dispute.status === 'early_warning' &&
                'The card network flagged a possible dispute. No action is required yet.'}
            </Text>
          </Box>
        )}
      </Box>
    </DashboardBody>
  )
}

export default DisputeDetailPage
