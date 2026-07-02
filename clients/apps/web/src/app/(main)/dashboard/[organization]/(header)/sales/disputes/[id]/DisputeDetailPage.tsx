'use client'

import { DisputeBanner } from '@/components/Disputes/DisputeBanner'
import { DisputeContextView } from '@/components/Disputes/DisputeContextView'
import { DisputeConversation } from '@/components/Disputes/DisputeConversation'
import { DisputeCountdownBadge } from '@/components/Disputes/DisputeCountdownBadge'
import { DisputeTimeline } from '@/components/Disputes/DisputeTimeline'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useDispute } from '@/hooks/queries/disputes'
import { useSupportCase } from '@/hooks/queries/org'
import { useOrder } from '@/hooks/queries/orders'
import { buildCustomerDashboardPath } from '@/utils/customer'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

const RESOLUTION: Record<string, { title: string; description: string }> = {
  won: {
    title: 'You won this dispute',
    description:
      'The card network ruled in your favor. The disputed amount remains yours.',
  },
  lost: {
    title: 'This dispute was lost',
    description:
      'The card network ruled in the customer’s favor. The amount and fees were deducted from your balance.',
  },
  prevented: {
    title: 'This dispute was prevented',
    description:
      'We refunded the customer before the dispute was escalated, avoiding any fees.',
  },
}

const Spinner = () => (
  <Box alignItems="center" justifyContent="center" paddingVertical="3xl">
    <Loader2 className="dark:text-polar-400 h-5 w-5 animate-spin text-gray-500" />
  </Box>
)

interface Props {
  organization: schemas['Organization']
  disputeId: string
}

const DisputeDetailPage = ({ organization, disputeId }: Props) => {
  const { data: dispute, isLoading } = useDispute(disputeId)
  const { data: order } = useOrder(dispute?.order_id)
  const { data: thread, isLoading: threadLoading } = useSupportCase(
    dispute?.case_id ?? undefined,
  )

  if (isLoading) {
    return (
      <DashboardBody>
        <Spinner />
      </DashboardBody>
    )
  }

  if (!dispute) {
    return (
      <DashboardBody>
        <Box
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          paddingVertical="3xl"
          rowGap="s"
          textAlign="center"
        >
          <Text variant="label">Dispute not found</Text>
          <Text color="muted">
            This dispute does not exist or you do not have access to it.
          </Text>
        </Box>
      </DashboardBody>
    )
  }

  if (order && order.customer.organization_id !== organization.id) {
    notFound()
  }

  const hasResponded =
    dispute.status === 'under_review' ||
    (thread?.messages ?? []).some(
      (message) => message.author_kind === 'merchant',
    )
  const resolution = RESOLUTION[dispute.status]

  let body: React.ReactNode
  let bodyClassName: string | undefined
  if (dispute.closed) {
    body = (
      <Box flexDirection="column" rowGap="xl">
        <ShadowBox className="flex flex-col gap-2">
          <h2 className="text-lg">{resolution?.title ?? 'Dispute closed'}</h2>
          {resolution && <Text color="muted">{resolution.description}</Text>}
        </ShadowBox>
        {dispute.case_id && hasResponded && (
          <DisputeConversation
            organization={organization}
            caseId={dispute.case_id}
          />
        )}
      </Box>
    )
  } else if (dispute.case_id != null && threadLoading) {
    body = <Spinner />
  } else if (hasResponded && dispute.case_id) {
    bodyClassName = 'min-h-0 flex-1'
    body = (
      <DisputeConversation
        organization={organization}
        caseId={dispute.case_id}
        fillHeight
      />
    )
  } else {
    body = (
      <Box flexDirection="column" rowGap="2xl">
        <DisputeBanner dispute={dispute} organization={organization} />
        <DisputeTimeline
          dispute={dispute}
          order={order}
          messages={thread?.messages ?? []}
        />
      </Box>
    )
  }

  return (
    <DashboardBody
      title={
        <Box
          alignItems="center"
          justifyContent="between"
          columnGap="m"
          flexGrow={1}
        >
          <Box flexDirection="column" rowGap="xs">
            <Box alignItems="center" columnGap="s">
              <Text variant="heading-xs" as="h2">
                {formatCurrency('standard')(dispute.amount, dispute.currency)}{' '}
                {dispute.currency.toUpperCase()}
              </Text>
              <DisputeCountdownBadge dispute={dispute} />
            </Box>
            {order && (
              <Text color="muted">
                Charged to{' '}
                <Link
                  href={buildCustomerDashboardPath(
                    organization.slug,
                    order.customer,
                  )}
                  className="underline"
                >
                  {order.customer.name || order.customer.email}
                </Link>
              </Text>
            )}
          </Box>
        </Box>
      }
      contextViewTitle="Details"
      contextViewClassName="bg-transparent dark:bg-transparent border-none rounded-none md:shadow-none"
      contextView={
        order ? (
          <DisputeContextView organization={organization} order={order} />
        ) : undefined
      }
      className={bodyClassName}
    >
      {body}
    </DashboardBody>
  )
}

export default DisputeDetailPage
