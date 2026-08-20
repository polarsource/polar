'use client'

import { schemas } from '@polar-sh/client'
import { Alert, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { SwitchPanel } from '../switch/SwitchPanel'
import { OpsUpdate } from './OpsUpdate'
import { StepCopy } from './panTransferCopy'
import { PanTransferStepForm } from './PanTransferStepForm'
import { StartCopyStep } from './StartCopyStep'

const SWITCH_STEP_KEY = 'cutover'
const START_COPY_STEP_KEY = 'start_copy'

interface Props {
  step: schemas['PanTransferStep']
  copy: StepCopy
  destinationAccountId: string | null
  migrationId: string
}

export function PanTransferStepBody({
  step,
  copy,
  destinationAccountId,
  migrationId,
}: Props) {
  if (step.key === START_COPY_STEP_KEY) {
    return (
      <StartCopyStep
        step={step}
        copy={copy}
        destinationAccountId={destinationAccountId}
        migrationId={migrationId}
      />
    )
  }

  const submittable = step.owner === 'merchant' && step.kind !== 'auto'
  // A newer backend: submitting would 422 on a field we never rendered, because
  // the accepted-input contract isn't on the wire.
  const fieldsUnknown = step.kind === 'input' && !copy.inputs?.length

  return (
    <Box flexDirection="column" rowGap="l">
      <Text variant="caption" color="muted">
        {copy.description}
      </Text>

      {copy.guidance && (
        <Box as="ol" flexDirection="column" rowGap="xs">
          {copy.guidance.map((line, index) => (
            <Box as="li" key={index} display="flex" columnGap="s">
              {/* The list marker is reset away, so spell the order out. */}
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

      <OpsUpdate step={step} />

      {step.key === SWITCH_STEP_KEY ? (
        <SwitchPanel migrationId={migrationId} />
      ) : (
        submittable &&
        (fieldsUnknown || !copy.action ? (
          <Text variant="caption" color="muted">
            This step needs a newer version of this page. Please refresh.
          </Text>
        ) : (
          <PanTransferStepForm
            copy={copy}
            migrationId={migrationId}
            stepKey={step.key}
          />
        ))
      )}
    </Box>
  )
}
