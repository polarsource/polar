'use client'

import { ReviewChecklist } from '@/components/Finance/Account/ReviewChecklist'
import {
  STEP_LABELS,
  isIncompleteStep,
  isRequiredStep,
} from '@/components/Finance/Account/sections/stepLabels'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { toast } from '@/components/Toast/use-toast'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { usePostHog } from '@/hooks/posthog'
import { useProducts } from '@/hooks/queries'
import {
  useOrganizationKYC,
  useOrganizationReviewState,
  useSubmitOrganizationReview,
} from '@/hooks/queries/org'
import {
  usePayoutAccount,
  usePayoutAccounts,
} from '@/hooks/queries/payout_accounts'
import { schemas } from '@polar-sh/client'
import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const ROW_STAGGER = 0.06
const ROW_DURATION = 0.32

interface Props {
  organization: schemas['Organization']
}

export const AccountPageDetailsRequired = ({ organization }: Props) => {
  const router = useRouter()
  const { data: reviewState, isLoading } = useOrganizationReviewState(
    organization.id,
  )

  // Warm up query caches to prevent flickering
  useOrganizationKYC(organization.id)
  useProducts(organization.id, { limit: 1 })
  usePayoutAccounts()
  usePayoutAccount(organization.payout_account_id || undefined)

  const submitReview = useSubmitOrganizationReview(organization.id)
  const posthog = usePostHog()

  const [isExiting, setIsExiting] = useState(false)

  const steps = reviewState?.preliminary_steps ?? []
  const rowsExitMs =
    (Math.max(0, steps.length - 1) * ROW_STAGGER + ROW_DURATION) * 1000

  const handleSubmit = async () => {
    if (isExiting) return

    posthog.capture('dashboard:organizations:account_review:submit', {
      organization_id: organization.id,
      section: 'cta',
    })

    setIsExiting(true)

    const [{ error }] = await Promise.all([
      submitReview.mutateAsync(),
      new Promise((resolve) => setTimeout(resolve, rowsExitMs)),
    ])

    if (error) {
      toast({
        title: 'Submission failed',
        description: extractApiErrorMessage(
          error,
          'We could not submit your organization for review. Please try again.',
        ),
      })
      setIsExiting(false)
      return
    }

    posthog.capture('dashboard:organizations:account_review:done', {
      organization_id: organization.id,
      section: 'cta',
    })

    router.refresh()
  }

  const remainingSteps = steps.filter(
    (step) => isRequiredStep(step) && isIncompleteStep(step),
  )
  const canSubmit = !!reviewState?.can_submit

  const submitButton = (
    <Button
      onClick={handleSubmit}
      disabled={!canSubmit || isExiting}
      loading={isExiting}
      className="w-full sm:w-auto"
    >
      Submit for review
    </Button>
  )

  const submitAction =
    canSubmit || remainingSteps.length === 0 ? (
      submitButton
    ) : (
      <Tooltip>
        <TooltipTrigger asChild>
          <Box display="block" width={{ base: '100%', sm: 'auto' }}>
            {submitButton}
          </Box>
        </TooltipTrigger>
        <TooltipContent>
          <Box flexDirection="column" rowGap="xs">
            <Text variant="caption">Still needed before you submit:</Text>
            {remainingSteps.map((step) => (
              <Text key={step.key} variant="caption" color="muted">
                {STEP_LABELS[step.key]}
              </Text>
            ))}
          </Box>
        </TooltipContent>
      </Tooltip>
    )

  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-sm)!"
      title="Account Review"
    >
      <Box flexDirection="column" rowGap="xl" paddingBottom="3xl">
        <Text variant="body" color="muted">
          Verify your business so customers can buy from you. After you submit,
          our team will review your details and get back to you shortly.
        </Text>
        <ReviewChecklist
          isLoading={isLoading}
          isExiting={isExiting}
          steps={steps}
          rowStagger={ROW_STAGGER}
          rowDuration={ROW_DURATION}
        />
        <Box flexDirection="column" alignSelf={{ base: 'stretch', sm: 'end' }}>
          {submitAction}
        </Box>
      </Box>
    </DashboardBody>
  )
}
