'use client'

import { OnboardingLayout } from '@/components/Layout/OnboardingLayout'
import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import { useAuth } from '@/hooks/auth'
import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode } from 'react'

export const CLAIM_STEPS = [
  {
    id: 'account',
    title: 'Create an account',
    description: 'To continue the setup',
  },
  {
    id: 'claim',
    title: 'Claim',
    description: 'Take ownership of what your agent set up.',
  },
] as const

const AgentClaimLayout = ({
  currentStepIndex,
  title,
  subtitle,
  actions,
  children,
}: {
  currentStepIndex: number
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) => {
  const { currentUser } = useAuth()

  return (
    <OnboardingLayout
      branding={
        <Box color="text-primary">
          <PolarLogotype logoVariant="logotype" logoClassName="ml-0" />
        </Box>
      }
      steps={CLAIM_STEPS}
      currentStepIndex={currentStepIndex}
      footer={
        currentUser && (
          <Box alignItems="center" gap="s">
            <Avatar
              className="h-8 w-8"
              avatar_url={currentUser.avatar_url}
              name={currentUser.email}
            />
            <Box flexDirection="column">
              <Text variant="caption" color="muted">
                Signed in as
              </Text>
              <Text variant="label">{currentUser.email}</Text>
            </Box>
          </Box>
        )
      }
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </OnboardingLayout>
  )
}

export default AgentClaimLayout
