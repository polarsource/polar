'use client'

import { useOrganizationReviewStatus } from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { AccountPageApproved } from './AccountPageApproved'
import { AccountPageDetailsRequired } from './AccountPageDetailsRequired'
import { AccountPageInReview } from './AccountPageInReview'

interface Props {
  organization: schemas['Organization']
  initialReviewStatus?: schemas['OrganizationReviewStatus']
}

export const AccountPageRouter = ({
  organization,
  initialReviewStatus,
}: Props) => {
  const { data: reviewStatus } = useOrganizationReviewStatus(
    organization.id,
    true,
    3000,
    initialReviewStatus,
  )

  const isGrandfathered =
    reviewStatus?.verdict === 'PASS' &&
    reviewStatus?.reason === 'Grandfathered organization'
  const isDenied = organization.status === 'denied'
  const isActive = ['active', 'review', 'snoozed'].includes(organization.status)
  const hasSubmittedDetails = !!organization.details_submitted_at

  const requireDetails =
    !hasSubmittedDetails &&
    (!isGrandfathered || (isGrandfathered && !isActive && !isDenied))

  const isApproved = isDenied
    ? false
    : reviewStatus?.verdict === 'PASS' ||
      reviewStatus?.appeal_decision === 'approved' ||
      isActive

  if (requireDetails) {
    return <AccountPageDetailsRequired organization={organization} />
  }

  if (isApproved) {
    return <AccountPageApproved organization={organization} />
  }

  return <AccountPageInReview organization={organization} />
}
