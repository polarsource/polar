'use client'

import { useChecklistCardStyles } from '@/components/Finance/Account/ReviewChecklist'
import { StatusIcon } from '@/components/Finance/Account/StatusIcon'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { LoaderCircle } from '@polar-sh/orbit/icons'

export type StepState = 'done' | 'active' | 'waiting' | 'pending'

export interface Step {
  key: string
  state: StepState
  label: string
  description?: string | null
}

export const SetupCard = ({ children }: { children: React.ReactNode }) => {
  const cardStyles = useChecklistCardStyles()
  return (
    <Box display="block" {...cardStyles}>
      {children}
    </Box>
  )
}

export const SetupColumn = ({
  icon,
  title,
  done,
  total,
  children,
}: {
  icon: React.ReactNode
  title: string
  done: number
  total: number
  children: React.ReactNode
}) => (
  <Box flexDirection="column" rowGap="m">
    <Box flexDirection="column" rowGap="s">
      <Box alignItems="center" columnGap="s">
        {icon}
        <Text variant="title">{title}</Text>
        <Box display="block" marginLeft="auto">
          <Text variant="caption" color="muted">
            {done} of {total}
          </Text>
        </Box>
      </Box>
      <Box
        display="block"
        width="100%"
        height={4}
        borderRadius="full"
        backgroundColor="background-secondary"
        overflow="hidden"
      >
        <Box
          display="block"
          height={4}
          borderRadius="full"
          backgroundColor="background-inverse"
          width={`${total > 0 ? Math.round((done / total) * 100) : 0}%`}
          transitionProperty="all"
          transitionDuration="slow"
        />
      </Box>
    </Box>
    <Box flexDirection="column" rowGap="s">
      {children}
    </Box>
  </Box>
)

const StepIcon = ({ state }: { state: StepState }) =>
  state === 'active' ? (
    <Box
      alignItems="center"
      justifyContent="center"
      width={24}
      height={24}
      flexShrink={0}
      borderRadius="full"
      backgroundColor="background-secondary"
      color="text-accent"
    >
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
    </Box>
  ) : (
    <StatusIcon
      status={state === 'done' ? 'passed' : 'pending'}
      icon={state === 'waiting' ? 'waiting' : undefined}
    />
  )

const STATE_DESCRIPTIONS: Record<StepState, string> = {
  done: 'Done',
  active: 'In progress',
  waiting: 'Waiting for you',
  pending: 'Not started',
}

export const StepRow = ({ step }: { step: Step }) => (
  <Box alignItems="center" columnGap="s">
    <StepIcon state={step.state} />
    <Box flexDirection="column" rowGap="none" flex={1} minWidth={0}>
      <Text variant="label">{step.label}</Text>
      <Text variant="caption" color="muted" truncate>
        {step.description ?? STATE_DESCRIPTIONS[step.state]}
      </Text>
    </Box>
  </Box>
)
