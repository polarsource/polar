'use client'

import { schemas } from '@polar-sh/client'
import { Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { OpsUpdate } from './OpsUpdate'
import {
  ownerLabel,
  STEP_COPY,
  StepInputField,
  waitingLabel,
} from './panTransferCopy'
import { PanTransferStepBody } from './PanTransferStepBody'
import { STATE_LABELS, StepMarker, StepState } from '../stepMarker'

interface Props {
  step: schemas['PanTransferStep']
  current: boolean
  destinationAccountId: string | null
  migrationId: string
  organizationId: string
}

export function PanTransferStepItem({
  step,
  current,
  destinationAccountId,
  migrationId,
  organizationId,
}: Props) {
  const copy = STEP_COPY[step.key]
  // Keep the row on an unknown key so the count and order still line up.
  const title = copy?.title ?? step.key
  const done = step.status === 'completed'
  const state: StepState = done ? 'done' : current ? 'current' : 'upcoming'

  return (
    <Box
      as="li"
      display="flex"
      columnGap="m"
      alignItems="start"
      aria-current={current ? 'step' : undefined}
    >
      <Box role="img" aria-label={STATE_LABELS[state]} paddingTop="xs">
        <StepMarker state={state} />
      </Box>

      <Box flex={1} minWidth={0} flexDirection="column" rowGap="m">
        <Box alignItems="center" columnGap="s" flexWrap="wrap">
          <Text
            variant={current ? 'label' : 'caption'}
            color={current ? 'default' : 'muted'}
          >
            {title}
          </Text>
          {current ? (
            <Status
              status={waitingLabel(step.owner)}
              color={step.owner === 'merchant' ? 'blue' : 'gray'}
              size="small"
            />
          ) : (
            !done && (
              <Text variant="caption" color="muted">
                {ownerLabel(step.owner)}
              </Text>
            )
          )}
        </Box>

        {done && <CompletedSummary step={step} fields={copy?.inputs ?? []} />}

        {/* Ops can annotate a step before it comes up; the current one gets
            its update from the body instead. */}
        {!done && !current && <OpsUpdate step={step} />}

        {current &&
          (copy ? (
            <Box
              flexDirection="column"
              padding="xl"
              rowGap="l"
              borderRadius="l"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              backgroundColor="background-card"
            >
              <PanTransferStepBody
                step={step}
                copy={copy}
                destinationAccountId={destinationAccountId}
                migrationId={migrationId}
                organizationId={organizationId}
              />
            </Box>
          ) : (
            <Text variant="caption" color="muted">
              This step needs a newer version of this page. Please refresh.
            </Text>
          ))}
      </Box>
    </Box>
  )
}

// The merchant may need to quote a reference back to their provider weeks
// later, so it outlives the open step.
function CompletedSummary({
  step,
  fields,
}: {
  step: schemas['PanTransferStep']
  fields: StepInputField[]
}) {
  const entered = fields.filter((field) => step.inputs[field.name])

  return (
    <Box flexDirection="column" rowGap="xs">
      {step.completed_at && (
        <Text variant="caption" color="muted">
          Done on <FormattedDateTime datetime={step.completed_at} />
        </Text>
      )}
      {/* Scroll rather than clip: the value has to stay readable in full. */}
      {entered.map((field) => (
        <Box key={field.name} overflowX="auto" maxWidth="100%">
          <Text variant="caption" color="muted" wrap="nowrap">
            {field.label}: {step.inputs[field.name]}
          </Text>
        </Box>
      ))}
    </Box>
  )
}
