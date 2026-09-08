import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

export interface OnboardingStep<StepId extends string> {
  id: StepId
  title: string
  description: ReactNode
}

interface OnboardingStepperProps<StepId extends string> {
  steps: readonly OnboardingStep<StepId>[]
  currentStepIndex: number
  onStepSelect?: (step: StepId) => void
  stepDescriptions?: Partial<Record<StepId, ReactNode>>
}

export function OnboardingStepper<StepId extends string>({
  steps,
  currentStepIndex,
  onStepSelect,
  stepDescriptions,
}: OnboardingStepperProps<StepId>) {
  return (
    <Box as="ol" flexDirection="column" rowGap="xl">
      {steps.map((step, index) => {
        const isCompleted = index < currentStepIndex
        const isCurrent = index === currentStepIndex
        const isClickable = isCompleted && Boolean(onStepSelect)

        return (
          <Box
            as="li"
            key={step.id}
            display="flex"
            alignItems="center"
            columnGap="l"
            cursor={isClickable ? { base: 'pointer' } : undefined}
            opacity={isClickable ? { base: 1, hover: 0.7 } : undefined}
            transitionProperty={isClickable ? 'opacity' : undefined}
            transitionDuration={isClickable ? 'fast' : undefined}
            onClick={isClickable ? () => onStepSelect?.(step.id) : undefined}
          >
            <Box
              width={32}
              height={32}
              flexShrink={0}
              alignItems="center"
              justifyContent="center"
              borderRadius="full"
              backgroundColor={
                isCompleted || isCurrent ? 'background-inverse' : undefined
              }
              borderWidth={isCompleted ? 0 : 1}
              borderStyle="solid"
              borderColor="border-primary"
            >
              <Text
                as="span"
                variant="caption"
                color={isCompleted || isCurrent ? 'inverse' : 'muted'}
              >
                {isCompleted ? <Check size={14} /> : index + 1}
              </Text>
            </Box>
            <Box flexDirection="column">
              <Text variant="title">{step.title}</Text>
              <Text color="muted">
                {isCompleted
                  ? (stepDescriptions?.[step.id] ?? step.description)
                  : step.description}
              </Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
