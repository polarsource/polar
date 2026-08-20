'use client'

import { getServerURL } from '@/utils/api'
import { schemas } from '@polar-sh/client'
import { Alert, Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { ArrowUpRight, Download } from 'lucide-react'
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
    <Box flexDirection="column" rowGap="xl">
      <Text variant="caption" color="muted">
        {copy.description}
      </Text>

      <Box flexDirection="column" rowGap="m">
        <Text variant="label">1. Download customer CSV</Text>
        <Text variant="caption" color="muted">
          Upload this file in Stripe when you start the copy.
        </Text>
        <Box>
          <Button variant="secondary" size="sm" asChild>
            <a href={customerIdsUrl} target="_blank" rel="noopener noreferrer">
              <Box alignItems="center" columnGap="xs">
                <Download size={14} aria-hidden />
                Download customer CSV
              </Box>
            </a>
          </Button>
        </Box>
      </Box>

      <Box flexDirection="column" rowGap="m">
        <Text variant="label">2. Start copy in Stripe</Text>
        {destinationAccountId ? (
          <Box flexDirection="column" rowGap="xs" maxWidth={380}>
            <Text variant="caption" color="muted">
              Polar destination ID
            </Text>
            <CopyToClipboardInput value={destinationAccountId} variant="mono" />
          </Box>
        ) : (
          <Alert
            variant="danger"
            title="We can't show the Polar account ID right now"
            description="Please contact support before you start the copy in Stripe."
          />
        )}
        {copy.guidance && (
          <Box as="ol" flexDirection="column" rowGap="xs">
            {copy.guidance.map((line, index) => (
              <Box as="li" key={index} display="flex" columnGap="s">
                <Text variant="caption" color="muted" tabularNums>
                  {index + 1}.
                </Text>
                <Text variant="caption" color="muted">
                  {line}
                </Text>
              </Box>
            ))}
          </Box>
        )}
        {copy.warning && <Alert variant="warning" title={copy.warning} />}
      </Box>

      <Box flexDirection="column" rowGap="m">
        <Text variant="label">3. Save Stripe migration ID</Text>
        <Text variant="caption" color="muted">
          After you start the copy, paste the migration ID from Stripe. It
          starts with migreq_.
        </Text>
        <Box>
          <Button variant="secondary" size="sm" asChild>
            <a
              href={STRIPE_COPY_STATUS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Box alignItems="center" columnGap="xs">
                Open Stripe copy status
                <ArrowUpRight size={14} aria-hidden />
              </Box>
            </a>
          </Button>
        </Box>
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
  )
}
