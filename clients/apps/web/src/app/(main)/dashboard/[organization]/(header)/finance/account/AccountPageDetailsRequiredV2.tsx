'use client'

import { ReviewChecklist } from '@/components/Finance/Account/ReviewChecklist'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { toast } from '@/components/Toast/use-toast'
import { usePostHog } from '@/hooks/posthog'
import {
  useOrganizationKYC,
  useOrganizationReviewState,
  useSubmitOrganizationReview,
} from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'

interface Props {
  organization: schemas['Organization']
}

export const AccountPageDetailsRequiredV2 = ({ organization }: Props) => {
  const { data: reviewState, isLoading } = useOrganizationReviewState(
    organization.id,
  )

  // Warm the KYC query cache so expanding the Product Description section
  // doesn't show its loading state mid-accordion-animation.
  useOrganizationKYC(organization.id)

  const submitReview = useSubmitOrganizationReview(organization.id)
  const posthog = usePostHog()

  const handleSubmit = async () => {
    posthog.capture('dashboard:organizations:account_review:submit', {
      organization_id: organization.id,
      section: 'cta',
    })
    const { error } = await submitReview.mutateAsync()
    if (error) {
      toast({
        title: 'Submission failed',
        description:
          'We could not submit your organization for review. Please try again.',
      })
    }
  }

  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-sm)!"
      title="Account Review"
      header={
        <Button
          onClick={handleSubmit}
          disabled={!reviewState?.can_submit || submitReview.isPending}
          loading={submitReview.isPending}
        >
          Submit for review
        </Button>
      }
    >
      <Box display="flex" flexDirection="column" rowGap="xl">
        <Box display="flex" flexDirection="column" rowGap="s">
          <Text variant="body" color="muted">
            Verify your business so customers can buy from you. After you
            submit, our team will review your details and get back to you
            shortly.
          </Text>
        </Box>
        <ReviewChecklist
          isLoading={isLoading}
          steps={reviewState?.preliminary_steps ?? []}
        />
      </Box>
    </DashboardBody>
  )
}
