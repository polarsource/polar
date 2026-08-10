'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'

export const ONBOARDING_STEPS = [
  {
    id: 'personal',
    route: '/onboarding/personal',
    title: 'Personal details',
    description: 'Tell us a bit about yourself',
  },
  {
    id: 'business',
    route: '/onboarding/business',
    title: 'Business details',
    description: 'Tell us about your organization',
  },
  {
    id: 'product',
    route: '/onboarding/product',
    title: 'Product details',
    description: 'What you are building and selling',
  },
] as const

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id']

interface OnboardingStepperProps {
  currentIndex: number
}

export function OnboardingStepper({ currentIndex }: OnboardingStepperProps) {
  const router = useRouter()

  return (
    <Box as="ol" flexDirection="column" rowGap="xl">
      {ONBOARDING_STEPS.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <Box
            as="li"
            key={step.id}
            display="flex"
            alignItems="center"
            columnGap="l"
            onClick={isCompleted ? () => router.push(step.route) : undefined}
            cursor={isCompleted ? { hover: 'pointer' } : undefined}
            opacity={isCompleted ? { base: 1, hover: 0.7 } : undefined}
            transitionProperty="opacity"
            transitionDuration="fast"
          >
            <Box flexDirection="column" alignItems="center">
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
                {isCompleted ? (
                  <Text as="span" color="inverse">
                    <Check size={14} />
                  </Text>
                ) : (
                  <Text
                    as="span"
                    variant="caption"
                    color={isCurrent ? 'inverse' : 'muted'}
                  >
                    {index + 1}
                  </Text>
                )}
              </Box>
            </Box>
            <Box flexDirection="column">
              <Text variant="title">{step.title}</Text>
              <Text color="muted">{step.description}</Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
