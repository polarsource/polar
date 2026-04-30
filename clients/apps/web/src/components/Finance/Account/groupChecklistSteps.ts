import { schemas } from '@polar-sh/client'
import { ReviewChecklistStep } from './types'

const IDENTITY_CHILD_KEYS: schemas['OrganizationReviewCheckKey'][] = [
  'identity.email',
  'identity.social_links',
  'identity.stripe_identity_verification',
]

const STATUS_PRIORITY: Record<
  schemas['OrganizationReviewCheckStatus'],
  number
> = {
  passed: 0,
  pending: 1,
  warning: 2,
  failed: 3,
}

export const getParentStatus = (
  children: schemas['OrganizationReviewCheck'][],
): schemas['OrganizationReviewCheckStatus'] => {
  if (children.length === 0) return 'passed'
  return children.reduce(
    (worst, child) =>
      STATUS_PRIORITY[child.status] > STATUS_PRIORITY[worst]
        ? child.status
        : worst,
    'passed' as schemas['OrganizationReviewCheckStatus'],
  )
}

export const groupChecklistSteps = (
  steps: schemas['OrganizationReviewCheck'][],
): ReviewChecklistStep[] => {
  const identityChildren = steps.filter((step) =>
    IDENTITY_CHILD_KEYS.includes(step.key),
  )
  const nonIdentitySteps = steps.filter(
    (step) => !IDENTITY_CHILD_KEYS.includes(step.key),
  )

  if (identityChildren.length === 0) {
    return steps
  }

  const firstIdentityIndex = steps.findIndex((step) =>
    IDENTITY_CHILD_KEYS.includes(step.key),
  )
  const groupedIdentityStep: ReviewChecklistStep = {
    key: 'identity',
    status: getParentStatus(identityChildren),
    reasons: [],
    children: identityChildren,
  }

  const beforeIdentity = nonIdentitySteps.slice(0, firstIdentityIndex)
  const afterIdentity = nonIdentitySteps.slice(firstIdentityIndex)

  return [...beforeIdentity, groupedIdentityStep, ...afterIdentity]
}
