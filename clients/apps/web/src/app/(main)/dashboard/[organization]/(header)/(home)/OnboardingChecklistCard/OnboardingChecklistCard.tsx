'use client'

import { STEP_LABELS } from '@/components/Finance/Account/sections/stepLabels'
import { AiSetupModalContent } from './AiSetupModal'
import { useModal } from '@/components/Modal/useModal'
import { useOrganizationReviewState } from '@/hooks/queries/org'
import { usePostHog } from '@/hooks/posthog'
import { useAccountSetup } from '@/providers/accountSetup'
import { schemas } from '@polar-sh/client'
import { Button, InlineModal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight, RocketIcon, SparklesIcon } from 'lucide-react'
import Link from 'next/link'

const STEP_DESCRIPTIONS: Partial<
  Record<schemas['OrganizationReviewCheckKey'], string>
> = {
  'identity.email': 'Add a support email address customers can reach you at.',
  'identity.social_links':
    'Add your social profiles to help verify your identity.',
  'identity.stripe_identity_verification':
    'Verify your identity to unlock payouts.',
  product_description: 'Describe what you’re selling and who it’s for.',
  product_url: 'Add the website where your product lives.',
  payout_account: 'Connect a bank account to receive your payouts.',
  product_configuration: 'Create and configure your first product.',
  setup_readiness: 'Integrate checkout so customers can pay you.',
}

interface Props {
  organization: schemas['Organization']
}

export const OnboardingChecklistCard = ({ organization }: Props) => {
  const { data: reviewState, isLoading } = useOrganizationReviewState(
    organization.id,
  )
  const { setTargetStepKey } = useAccountSetup()
  const posthog = usePostHog()
  const {
    isShown: isAiSetupShown,
    show: showAiSetup,
    hide: hideAiSetup,
  } = useModal()

  const openAiSetup = () => {
    posthog.capture('dashboard:onboarding:ai_setup:open', {
      organization: organization.id,
    })
    showAiSetup()
  }

  const accountHref = `/dashboard/${organization.slug}/finance/account`

  if (isLoading) {
    return null
  }

  const steps = reviewState?.preliminary_steps ?? []
  const total = steps.length

  if (total === 0) {
    return null
  }

  const completed = steps.filter(
    (step) => step.status !== 'failed' && step.status !== 'pending',
  ).length
  const progress = Math.round((completed / total) * 100)
  const canSubmit = reviewState?.can_submit ?? false

  const nextStep = steps.find(
    (step) => step.status === 'failed' || step.status === 'pending',
  )
  const nextLabel = nextStep ? STEP_LABELS[nextStep.key] : null
  const nextDescription = nextStep ? STEP_DESCRIPTIONS[nextStep.key] : null

  return (
    <>
      <Box position="relative" marginTop="xl">
        <button
          type="button"
          onClick={openAiSetup}
          className="flex cursor-pointer focus:outline-none"
        >
          <Box
            position="absolute"
            top={-38}
            left={12}
            right={12}
            display="flex"
            paddingVertical="m"
            paddingHorizontal="l"
            borderTopLeftRadius="l"
            borderTopRightRadius="l"
            backgroundColor="background-card"
          >
            <Box
              flexDirection="row"
              alignItems="center"
              columnGap="xs"
              color={{ base: 'text-secondary', hover: 'text-primary' }}
              transitionProperty="colors"
              transitionDuration="fast"
            >
              <SparklesIcon size={14} />
              <Text variant="caption" color="inherit">
                Set up Polar with your coding agent
              </Text>
              <ChevronRight size={14} />
            </Box>
          </Box>
        </button>
        <Box
          position="relative"
          display="grid"
          gridTemplateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
          alignItems="stretch"
          overflow="hidden"
          borderRadius="l"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          backgroundColor="background-primary"
        >
          <Box
            flexDirection="column"
            rowGap="l"
            padding="xl"
            justifyContent="center"
          >
            <Box flexDirection="column" rowGap="m">
              <Box alignItems="center" columnGap="m">
                <RocketIcon className="h-4 w-4 shrink-0" />
                <Text variant="title">Finish setting up your account</Text>
              </Box>
              <Text color="muted">
                Set up your products and integrate into your app. Test the full
                flow with 100% discount codes. When you&rsquo;re ready, go live
                to start accepting payments from your customers.
              </Text>
            </Box>

            <Box flexDirection="column" rowGap="s">
              <Text color="muted">
                {completed} of {total} complete
              </Text>
              <Box
                display="block"
                width="100%"
                height={6}
                borderRadius="full"
                backgroundColor="background-secondary"
                overflow="hidden"
              >
                <Box
                  display="block"
                  height={6}
                  borderRadius="full"
                  backgroundColor="background-inverse"
                  width={`${progress}%`}
                />
              </Box>
            </Box>
          </Box>

          <Box
            flexDirection="column"
            rowGap="l"
            padding="xl"
            justifyContent="between"
            borderLeftWidth={{ base: 0, lg: 1 }}
            borderTopWidth={{ base: 1, lg: 0 }}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <Box flexDirection="column" rowGap="xs">
              {nextLabel ? (
                <>
                  <Text color="muted">Up next</Text>
                  <Text variant="title">{nextLabel}</Text>
                  {nextDescription && (
                    <Text color="muted">{nextDescription}</Text>
                  )}
                </>
              ) : (
                <>
                  <Text variant="title">You&rsquo;re ready</Text>
                  <Text color="muted">
                    All steps complete, submit your account for review.
                  </Text>
                </>
              )}
            </Box>
            <Link
              href={accountHref}
              onClick={() => {
                if (nextStep) {
                  setTargetStepKey(nextStep.key)
                }
              }}
            >
              <Button>
                {canSubmit ? 'Review & submit' : 'Continue setup'}
              </Button>
            </Link>
          </Box>
        </Box>
      </Box>

      <InlineModal
        isShown={isAiSetupShown}
        hide={hideAiSetup}
        modalContent={
          <AiSetupModalContent organization={organization} hide={hideAiSetup} />
        }
      />
    </>
  )
}
