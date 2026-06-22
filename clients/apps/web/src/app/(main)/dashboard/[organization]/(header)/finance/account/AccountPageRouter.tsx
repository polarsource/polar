'use client'

import { useOrganizationReviewStatus } from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
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
  const router = useRouter()
  const hasRefreshedRef = useRef(false)

  // A bit of a hack to automatically refresh the page once the
  // user is on it and their appeal gets approved
  const appealApprovedWhileDenied =
    organization.status === 'denied' &&
    reviewStatus?.appeal_decision === 'approved'
  useEffect(() => {
    if (appealApprovedWhileDenied && !hasRefreshedRef.current) {
      hasRefreshedRef.current = true
      router.refresh()
    }
  }, [appealApprovedWhileDenied, router])

  const isGrandfathered =
    reviewStatus?.verdict === 'PASS' &&
    reviewStatus?.reason === 'Grandfathered organization'
  const isDenied = organization.status === 'denied'
  // Statuses that retain payout/account access. Includes the terminal
  // `offboarded` state, where the merchant withdraws their remaining balance.
  const hasAccountAccess = [
    'active',
    'review',
    'snoozed',
    'offboarded',
  ].includes(organization.status)
  const hasSubmittedDetails = !!organization.details_submitted_at

  const requireDetails =
    !hasSubmittedDetails &&
    (!isGrandfathered || (isGrandfathered && !hasAccountAccess && !isDenied))

  const isApproved = isDenied
    ? false
    : reviewStatus?.verdict === 'PASS' ||
      reviewStatus?.appeal_decision === 'approved' ||
      hasAccountAccess

  if (requireDetails) {
    return <AccountPageDetailsRequired organization={organization} />
  }

  if (isApproved) {
    return <AccountPageApproved organization={organization} />
  }

  return <AccountPageInReview organization={organization} />
}
