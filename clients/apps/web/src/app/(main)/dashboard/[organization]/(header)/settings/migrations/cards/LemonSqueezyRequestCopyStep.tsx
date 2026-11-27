'use client'

import { schemas } from '@polar-sh/client'
import { Alert, Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { OpsUpdate } from './OpsUpdate'
import { StepCopy } from './panTransferCopy'
import { PanTransferStepForm } from './PanTransferStepForm'
import { TaskRow } from './StartCopyStep'

interface Props {
  step: schemas['PanTransferStep']
  copy: StepCopy
  destinationAccountId: string | null
  migrationId: string
}

export function LemonSqueezyRequestCopyStep({
  step,
  copy,
  destinationAccountId,
  migrationId,
}: Props) {
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
        <TaskRow
          title="Open Settings → Migration in Lemon Squeezy"
          description="Under New payment provider, choose Polar."
        >
          <Box>
            <Button variant="secondary" size="sm" asChild>
              <a
                href="https://app.lemonsqueezy.com/settings/migration"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Lemon Squeezy
              </a>
            </Button>
          </Box>
        </TaskRow>

        <TaskRow
          title="Enter the Polar account ID as the destination Stripe account"
          description="Then review the details, accept the acknowledgment and submit the request."
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
              description="Please contact support before you submit the request in Lemon Squeezy."
            />
          )}
        </TaskRow>
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
