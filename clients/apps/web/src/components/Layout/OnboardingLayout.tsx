import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode, Ref } from 'react'
import { OnboardingStepper, type OnboardingStep } from './OnboardingStepper'

interface OnboardingLayoutProps<StepId extends string> {
  branding: ReactNode
  introduction?: ReactNode
  footer?: ReactNode
  mobileFooter?: ReactNode
  steps?: readonly OnboardingStep<StepId>[]
  currentStepIndex?: number
  onStepSelect?: (step: StepId) => void
  stepDescriptions?: Partial<Record<StepId, ReactNode>>
  title?: string
  subtitle?: string
  actions?: ReactNode
  actionsContainerRef?: Ref<HTMLElement>
  children?: ReactNode
}

export function OnboardingLayout<StepId extends string>({
  branding,
  introduction,
  footer,
  mobileFooter,
  steps = [],
  currentStepIndex = -1,
  onStepSelect,
  stepDescriptions,
  title,
  subtitle,
  actions,
  actionsContainerRef,
  children,
}: OnboardingLayoutProps<StepId>) {
  return (
    <Box
      minHeight="100dvh"
      alignItems={{ base: undefined, lg: 'center' }}
      justifyContent="center"
      backgroundColor={{ base: undefined, lg: 'background-primary' }}
      overflowX="hidden"
      padding={{ base: 'none', lg: '2xl' }}
    >
      <Box
        width="100%"
        maxWidth={{ base: undefined, lg: '80rem' }}
        alignItems="stretch"
        columnGap="2xl"
        backgroundColor={{ base: undefined, lg: 'background-secondary' }}
        borderRadius="l"
        padding={{ base: 'none', lg: 's' }}
        borderWidth={{ base: 0, lg: 1 }}
        borderStyle="solid"
        borderColor="border-secondary"
      >
        <Box
          as="aside"
          display={{ base: 'none', lg: 'flex' }}
          width={320}
          flexShrink={0}
          flexDirection="column"
          justifyContent="between"
          rowGap="2xl"
          padding="2xl"
          paddingBottom="l"
        >
          <Box flexDirection="column" rowGap="3xl">
            {branding}
            {introduction}
            {steps.length > 0 && (
              <OnboardingStepper
                steps={steps}
                currentStepIndex={currentStepIndex}
                onStepSelect={onStepSelect}
                stepDescriptions={stepDescriptions}
              />
            )}
          </Box>
          {footer && (
            <Box minHeight={40} alignItems="center">
              {footer}
            </Box>
          )}
        </Box>

        <Box
          as="main"
          flex={1}
          alignSelf={{ base: 'stretch', lg: 'center' }}
          flexDirection="column"
          alignItems="center"
          backgroundColor={{ base: undefined, lg: 'background-primary' }}
          borderRadius={{ base: 'none', lg: 'm' }}
          borderWidth={{ base: 0, lg: 1 }}
          borderStyle="solid"
          borderColor="border-secondary"
          height={{ base: undefined, lg: '50rem' }}
          overflow={{ base: 'visible', lg: 'hidden' }}
        >
          <Box
            width="100%"
            flex={{ base: undefined, lg: 1 }}
            justifyContent="center"
            overflowY={{ base: 'visible', lg: 'auto' }}
            paddingTop={{ base: 'xl', lg: '3xl' }}
            paddingBottom={{ base: '5xl', lg: '3xl' }}
            paddingHorizontal="l"
          >
            <Box
              width="100%"
              maxWidth="28rem"
              flexDirection="column"
              rowGap="2xl"
            >
              <Box
                display={{ base: 'flex', lg: 'none' }}
                flexDirection="column"
                rowGap="xl"
              >
                {branding}
                {introduction}
                {steps.length > 0 && (
                  <Box width="100%" alignItems="center" gap="s">
                    {steps.map((flowStep, index) => (
                      <Box key={flowStep.id} flex={1}>
                        <Box
                          display="block"
                          height={2}
                          width="100%"
                          borderRadius="full"
                          backgroundColor={
                            index <= currentStepIndex
                              ? 'background-inverse'
                              : 'background-card'
                          }
                        />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              {(title || subtitle) && (
                <Box flexDirection="column" rowGap="m">
                  {title && <Text variant="heading-xs">{title}</Text>}
                  {subtitle && (
                    <Text variant="body" color="muted">
                      {subtitle}
                    </Text>
                  )}
                </Box>
              )}

              {children}
              {mobileFooter}
            </Box>
          </Box>

          {(actions || actionsContainerRef) && (
            <Box
              width="100%"
              flexShrink={0}
              justifyContent="center"
              position={{ base: 'fixed', lg: 'static' }}
              bottom={0}
              left={0}
              right={0}
              zIndex={10}
              borderTopWidth={1}
              borderStyle="solid"
              borderColor="border-secondary"
              backgroundColor="background-primary"
              padding="l"
            >
              <Box ref={actionsContainerRef} width="100%" justifyContent="end">
                {actions}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
