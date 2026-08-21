'use client'

import { getServerURL } from '@/utils/api'
import { schemas } from '@polar-sh/client'
import { Alert, Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { OpsUpdate } from './OpsUpdate'
import { StepCopy, STRIPE_COPY_STATUS_URL } from './panTransferCopy'
import { PanTransferStepForm } from './PanTransferStepForm'

interface Props {
  step: schemas['PanTransferStep']
  copy: StepCopy
  destinationAccountId: string | null
  migrationId: string
}

export function StartCopyStep({
  step,
  copy,
  destinationAccountId,
  migrationId,
}: Props) {
  const customerIdsUrl = `${getServerURL()}/v1/merchant-migrations/${migrationId}/customer-ids.csv`

  return (
    <Box flexDirection="column" rowGap="l" maxWidth={640}>
      <Text variant="caption" color="muted">
        {copy.description}
      </Text>

      <Box as="ol" flexDirection="column" rowGap="l">
        <Box as="li" flexDirection="column" rowGap="s">
          <Text variant="caption">
            1. Download the customer CSV and upload it in Stripe.
          </Text>
          <Box>
            <Button variant="secondary" size="sm" asChild>
              <a
                href={customerIdsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download CSV
              </a>
            </Button>
          </Box>
        </Box>

        <Box as="li" flexDirection="column" rowGap="s">
          <Text variant="caption">
            2. In Stripe, open Customers → Copy customers and paste this Polar
            account ID as the recipient.
          </Text>
          {destinationAccountId ? (
            <Box flexDirection="column" rowGap="xs" maxWidth={420}>
              <Text variant="caption" color="muted">
                Polar account ID
              </Text>
              <CopyToClipboardInput
                value={destinationAccountId}
                variant="mono"
              />
            </Box>
          ) : (
            <Alert
              variant="danger"
              title="We can't show the Polar account ID right now"
              description="Please contact support before you start the copy in Stripe."
            />
          )}
          {copy.warning && (
            <Text variant="caption">Important: {copy.warning}</Text>
          )}
          <Box>
            <Button variant="secondary" size="sm" asChild>
              <a
                href={STRIPE_COPY_STATUS_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Stripe copy status
              </a>
            </Button>
          </Box>
        </Box>

        <Box as="li" flexDirection="column" rowGap="s">
          <Text variant="caption">
            3. After starting the copy, paste the optional Stripe migration ID.
          </Text>
          <OpsUpdate step={step} />
          {copy.action && (
            <PanTransferStepForm
              copy={copy}
              migrationId={migrationId}
              stepKey={step.key}
            />
          )}
        </Box>
      </Box>
    </Box>
  )
}
