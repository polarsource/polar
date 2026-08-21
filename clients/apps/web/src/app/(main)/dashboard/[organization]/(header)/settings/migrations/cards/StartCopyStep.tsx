'use client'

import { getServerURL } from '@/utils/api'
import { schemas } from '@polar-sh/client'
import { Alert, Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import type { ReactNode } from 'react'
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
    <Box flexDirection="column" rowGap="l" maxWidth={720}>
      <Text variant="caption" color="muted">
        {copy.description}
      </Text>

      <Box
        as="ol"
        flexDirection="column"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
      >
        <TaskRow title="Upload customer CSV in Stripe">
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
        </TaskRow>

        <TaskRow
          title="Paste Polar account ID as recipient"
          description="Stripe → Customers → Copy customers"
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
        </TaskRow>

        <TaskRow title="Track copy progress in Stripe">
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
        </TaskRow>
      </Box>

      {copy.warning && <Text variant="caption">Important: {copy.warning}</Text>}
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

function TaskRow({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Box
      as="li"
      display={{ base: 'flex', md: 'grid' }}
      flexDirection="column"
      gridTemplateColumns={{
        base: '1fr',
        md: 'minmax(0, 1fr) 320px',
      }}
      alignItems={{ base: 'stretch', md: 'center' }}
      columnGap="xl"
      rowGap="m"
      paddingVertical="l"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
    >
      <Box flexDirection="column" rowGap="xs">
        <Text variant="caption">{title}</Text>
        {description && (
          <Text variant="caption" color="muted">
            {description}
          </Text>
        )}
      </Box>
      <Box
        width="100%"
        justifyContent={{ base: 'start', md: 'end' }}
        flexShrink={0}
      >
        {children}
      </Box>
    </Box>
  )
}
