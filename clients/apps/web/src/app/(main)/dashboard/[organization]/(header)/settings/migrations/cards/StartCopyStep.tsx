'use client'

import { getServerURL } from '@/utils/api'
import { schemas } from '@polar-sh/client'
import { Alert, Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import type { MigrationSource } from '../sources'
import { CopyTaskRow } from './CopyTaskRow'
import { LemonSqueezyCopyTasks } from './LemonSqueezyCopyTasks'
import { OpsUpdate } from './OpsUpdate'
import { StepCopy, stripeCopyStatusUrl } from './panTransferCopy'
import { PanTransferStepForm } from './PanTransferStepForm'

interface Props {
  step: schemas['PanTransferStep']
  copy: StepCopy
  destinationAccountId: string | null
  migrationId: string
  source: MigrationSource
  sourceStripeAccountId?: string
}

export function StartCopyStep({
  step,
  copy,
  destinationAccountId,
  migrationId,
  source,
  sourceStripeAccountId,
}: Props) {
  const customerIdsUrl = `${getServerURL()}/v1/merchant-migrations/${migrationId}/customer-ids.csv`

  return (
    <Box flexDirection="column" rowGap="l" maxWidth={720}>
      <Text color="muted">{copy.description}</Text>

      <Box
        as="ol"
        flexDirection="column"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
      >
        {source === 'lemon_squeezy' ? (
          <LemonSqueezyCopyTasks destinationAccountId={destinationAccountId} />
        ) : (
          <>
            <CopyTaskRow
              title="Upload the customer CSV in Stripe"
              description="Download it here, then open Stripe → Customers → Copy customers and choose Upload from file under Copy Method."
            >
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
            </CopyTaskRow>

            <CopyTaskRow
              title="Paste the Polar account ID as the recipient"
              description={
                copy.warning
                  ? `On that same page, then start the copy. ${copy.warning}`
                  : 'On that same page, then start the copy.'
              }
            >
              {destinationAccountId ? (
                <Box width="100%">
                  <CopyToClipboardInput
                    value={destinationAccountId}
                    variant="mono"
                    ariaLabel="Polar account ID"
                  />
                </Box>
              ) : (
                <Alert
                  variant="danger"
                  title="We can't show the Polar account ID right now"
                  description="Please contact support before you start the copy in Stripe."
                />
              )}
            </CopyTaskRow>

            <CopyTaskRow
              title="Come back and paste the migreq id"
              description="Find it on Stripe copy status."
            >
              <Box>
                <Button variant="secondary" size="sm" asChild>
                  <a
                    href={stripeCopyStatusUrl(sourceStripeAccountId)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Stripe copy status
                  </a>
                </Button>
              </Box>
            </CopyTaskRow>
          </>
        )}
      </Box>

      <OpsUpdate step={step} />
      {copy.action && (
        <PanTransferStepForm
          copy={copy}
          migrationId={migrationId}
          stepKey={step.key}
          compact
        />
      )}
    </Box>
  )
}
