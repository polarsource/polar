'use client'

import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { ExternalLinkIcon } from 'lucide-react'
import type { ReactNode } from 'react'

const REFUNDS_DOCS_URL = 'https://docs.polar.sh/features/refunds'

const BannerColumn = ({
  divided = false,
  children,
}: {
  divided?: boolean
  children: ReactNode
}) => (
  <Box
    flexDirection="column"
    rowGap="m"
    paddingVertical="xl"
    paddingHorizontal="2xl"
    borderTopWidth={divided ? { base: 1, lg: 0 } : undefined}
    borderLeftWidth={divided ? { base: 0, lg: 1 } : undefined}
    borderStyle={divided ? 'solid' : undefined}
    borderColor={divided ? 'border-primary' : undefined}
  >
    {children}
  </Box>
)

interface ChargebackPreventionBannerProps {
  refund: schemas['Refund']
}

export const ChargebackPreventionBanner = ({
  refund,
}: ChargebackPreventionBannerProps) => {
  return (
    <Box
      flexDirection="column"
      overflow="hidden"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box
        alignItems="center"
        columnGap="m"
        paddingHorizontal="2xl"
        paddingVertical="l"
      >
        <Text variant="body">We prevented a chargeback for this order</Text>
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <BannerColumn>
          <Box flexDirection="column" rowGap="xs">
            <Text color="muted">Refund issued</Text>
            <Text variant="body">
              <FormattedDateTime
                resolution="day"
                datetime={refund.created_at}
              />
            </Text>
          </Box>
          <Box
            flexDirection="column"
            rowGap="xs"
            backgroundColor="background-card"
            borderRadius="m"
            padding="l"
          >
            <Text variant="caption" color="muted">
              Amount refunded
            </Text>
            <Text>
              {formatCurrency('standard')(refund.amount, refund.currency)}
            </Text>
          </Box>
        </BannerColumn>

        <BannerColumn divided>
          <Text color="muted">Why this happened</Text>
          <Text>
            Our early-warning system detected that the customer started to file
            a chargeback for this transaction. To help you avoid the fees and
            risks of a formal dispute, we refunded the payment before it was
            officially filed.
          </Text>
          <Text>
            A formal chargeback can mean losing the transaction amount on top of
            extra dispute fees, and a rising dispute ratio can hurt your account
            over time. Refunding proactively is usually the least costly
            outcome.
          </Text>
          <a
            href={REFUNDS_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit"
          >
            <Box
              as="span"
              display="inline-flex"
              alignItems="center"
              columnGap="xs"
            >
              <Text as="span">
                <span className="underline">Learn more</span>
              </Text>
              <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
            </Box>
          </a>
        </BannerColumn>
      </Box>
    </Box>
  )
}
