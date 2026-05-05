'use client'

import { ReviewChecklist } from '@/components/Finance/Account/ReviewChecklist'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { toast } from '@/components/Toast/use-toast'
import {
  useOrganizationReviewState,
  useSubmitOrganizationReview,
} from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'

interface Props {
  organization: schemas['Organization']
}

export const AccountPageDetailsRequiredV2 = ({ organization }: Props) => {
  const { data: reviewState, isLoading } = useOrganizationReviewState(
    organization.id,
  )

  const submitReview = useSubmitOrganizationReview(organization.id)

  const handleSubmit = async () => {
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
      <Box display="flex" flexDirection="column" rowGap="m">
        <ReviewChecklist
          isLoading={isLoading}
          steps={reviewState?.preliminary_steps ?? []}
        />
      </Box>
    </DashboardBody>
  )
}
